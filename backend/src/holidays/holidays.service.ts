import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { HolidayOnTaskAction, HolidayAuditAction, HolidayEntityType, HolidayStatus, HolidayType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { ancestorChain, descendantIds, holidayReaches, type DeptNode } from './dept-tree.util'
import type { UpdateHolidayMasterDto } from './dto/update-holiday-master.dto'
import type { UpdateWorkingDaysDto } from './dto/update-working-days.dto'
import type { CreateOrgHolidayDto, UpdateOrgHolidayDto } from './dto/create-org-holiday.dto'
import type { CreateDepartmentHolidayDto, UpdateDepartmentHolidayDto } from './dto/create-department-holiday.dto'
import type { CreateIndividualHolidayDto, UpdateIndividualHolidayDto, CreateIndividualWorkingDaysDto, UpdateIndividualWorkingDaysDto } from './dto/create-individual-holiday.dto'

/** A department holiday plus where-it-came-from metadata for the dept calendar UI. */
export interface ResolvedDeptHoliday {
  id: string
  organization_id: string
  department_id: string
  name: string
  date: Date
  end_date: Date | null
  type: HolidayType
  is_recurring_yearly: boolean
  description: string | null
  status: HolidayStatus
  year: number
  created_at: Date
  updated_at: Date
  /** True when this department inherits the holiday from an ancestor (a link, not a copy). */
  inherited: boolean
  /** Origin department of an inherited holiday (the cascade source); null for own holidays. */
  source_department_id: string | null
  source_department_name: string | null
  source_department_head_user_id: string | null
  source_department_head_name: string | null
  /** For an own holiday: how many descendant departments it currently cascades to. */
  cascade_target_count: number
}

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Defaults ────────────────────────────────────────────────────────────────

  async ensureDefaults(orgId: string) {
    const [master] = await Promise.all([
      this.prisma.holidayMaster.upsert({
        where: { organization_id: orgId },
        create: { organization_id: orgId },
        update: {},
      }),
      this.prisma.orgWorkingDays.upsert({
        where: { organization_id: orgId },
        create: { organization_id: orgId },
        update: {},
      }),
    ])
    return master
  }

  // ─── Master config ────────────────────────────────────────────────────────────

  async getConfig(orgId: string) {
    return this.ensureDefaults(orgId)
  }

  async updateConfig(orgId: string, dto: UpdateHolidayMasterDto) {
    await this.ensureDefaults(orgId)
    const prev = await this.prisma.holidayMaster.findUnique({ where: { organization_id: orgId } })
    const updated = await this.prisma.holidayMaster.update({
      where: { organization_id: orgId },
      data: {
        ...(dto.country_code !== undefined && { country_code: dto.country_code }),
        ...(dto.holiday_on_task_action && { holiday_on_task_action: dto.holiday_on_task_action }),
        ...(dto.priority_level && { priority_level: dto.priority_level }),
        ...(dto.pending_review_deadline_days !== undefined && { pending_review_deadline_days: dto.pending_review_deadline_days }),
        ...(dto.auto_apply_if_not_reviewed !== undefined && { auto_apply_if_not_reviewed: dto.auto_apply_if_not_reviewed }),
      },
    })
    return updated
  }

  // ─── Working Day Calculation ──────────────────────────────────────────────────

  async isWorkingDay(date: Date, orgId: string, deptId?: string, userId?: string): Promise<boolean> {
    const master = await this.prisma.holidayMaster.findUnique({ where: { organization_id: orgId } })
    const priority = master?.priority_level ?? 'individual_first'

    if (priority === 'org_first') {
      return this.checkOrgWorkingDay(date, orgId)
    }

    if (priority === 'individual_first') {
      if (userId) {
        const result = await this.checkIndividualWorkingDay(date, orgId, userId)
        if (result !== null) return result
      }
      if (deptId) {
        const result = await this.checkDeptWorkingDay(date, orgId, deptId)
        if (result !== null) return result
      }
      return this.checkOrgWorkingDay(date, orgId)
    }

    // department_first
    if (deptId) {
      const result = await this.checkDeptWorkingDay(date, orgId, deptId)
      if (result !== null) return result
    }
    if (userId) {
      const result = await this.checkIndividualWorkingDay(date, orgId, userId)
      if (result !== null) return result
    }
    return this.checkOrgWorkingDay(date, orgId)
  }

  private async checkOrgWorkingDay(date: Date, orgId: string): Promise<boolean> {
    const wd = await this.prisma.orgWorkingDays.findUnique({ where: { organization_id: orgId } })
    const workingDays = (wd?.working_days as number[]) ?? [1, 2, 3, 4, 5]
    if (!workingDays.includes(date.getDay())) return false

    const holidays = await this.prisma.orgHoliday.findMany({
      where: { organization_id: orgId, status: HolidayStatus.active },
    })
    return !this.matchesAnyHoliday(date, holidays)
  }

  private async checkDeptWorkingDay(date: Date, orgId: string, deptId: string): Promise<boolean | null> {
    const wd = await this.prisma.departmentWorkingDays.findUnique({
      where: { organization_id_department_id: { organization_id: orgId, department_id: deptId } },
    })
    // Effective holidays = this dept's own + any inherited from ancestors (minus
    // local opt-outs). So a cascaded holiday blocks task scheduling here too,
    // not just the calendar display.
    const holidays = await this.resolveDeptHolidays(orgId, deptId, { activeOnly: true })
    if (!wd && holidays.length === 0) return null
    const workingDays = wd ? (wd.working_days as number[]) : [1, 2, 3, 4, 5]
    if (!workingDays.includes(date.getDay())) return false
    return !this.matchesAnyHoliday(date, holidays)
  }

  private async checkIndividualWorkingDay(date: Date, orgId: string, userId: string): Promise<boolean | null> {
    // Use most recently created schedule that covers this date
    const schedule = await this.prisma.individualWorkingDays.findFirst({
      where: {
        organization_id: orgId,
        user_id: userId,
        effective_from: { lte: date },
        OR: [{ effective_to: null }, { effective_to: { gte: date } }],
      },
      orderBy: { created_at: 'desc' },
    })
    const holidays = await this.prisma.individualHoliday.findMany({
      where: { organization_id: orgId, user_id: userId },
    })
    if (!schedule && holidays.length === 0) return null
    const workingDays = schedule ? (schedule.working_days as number[]) : [1, 2, 3, 4, 5]
    if (!workingDays.includes(date.getDay())) return false
    return !this.matchesAnyHoliday(date, holidays)
  }

  /**
   * Whether `date` falls on a holiday — supporting both single-day holidays and
   * inclusive ranges (`end_date`). For recurring-yearly holidays only the month/day
   * matters, so a range is compared on month/day (handling a year-wrap span).
   */
  private dateMatchesHoliday(
    date: Date,
    h: { date: Date; end_date?: Date | null; is_recurring_yearly: boolean },
  ): boolean {
    const start = new Date(h.date)
    const end = h.end_date ? new Date(h.end_date) : start

    if (h.is_recurring_yearly) {
      const md = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate()
      const s = md(start), e = md(end), x = md(date)
      return s <= e ? x >= s && x <= e : x >= s || x <= e
    }

    const dayMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const x = dayMs(date)
    return x >= dayMs(start) && x <= dayMs(end)
  }

  private matchesAnyHoliday(
    date: Date,
    holidays: { date: Date; end_date?: Date | null; is_recurring_yearly: boolean }[],
  ): boolean {
    return holidays.some((h) => this.dateMatchesHoliday(date, h))
  }

  // ─── Deadline Adjustment ──────────────────────────────────────────────────────

  async adjustDeadline(
    date: Date,
    orgId: string,
    deptId?: string,
    userId?: string,
    entityType?: HolidayEntityType,
    entityId?: string,
    entityTitle?: string,
    forTicket = false,
  ): Promise<Date | null> {
    const working = await this.isWorkingDay(date, orgId, deptId, userId)
    if (working) return date

    const master = await this.prisma.holidayMaster.findUnique({ where: { organization_id: orgId } })
    let action = master?.holiday_on_task_action ?? HolidayOnTaskAction.move_to_next_working_day

    // Tickets never skip — treat skip_create as move_to_next_working_day
    if (forTicket && action === HolidayOnTaskAction.skip_create) {
      action = HolidayOnTaskAction.move_to_next_working_day
    }

    const holidayName = await this.getHolidayNameForDate(date, orgId, deptId, userId)

    let adjusted: Date | null
    let auditAction: HolidayAuditAction

    switch (action) {
      case HolidayOnTaskAction.skip_create:
        adjusted = null
        auditAction = HolidayAuditAction.skipped
        break
      case HolidayOnTaskAction.create_anyway:
        adjusted = date
        auditAction = HolidayAuditAction.created_anyway
        break
      case HolidayOnTaskAction.move_to_prev_working_day:
        adjusted = await this.getPrevWorkingDay(date, orgId, deptId, userId)
        auditAction = HolidayAuditAction.moved_backward
        break
      case HolidayOnTaskAction.move_to_next_working_day:
      default:
        adjusted = await this.getNextWorkingDay(date, orgId, deptId, userId)
        auditAction = HolidayAuditAction.moved_forward
        break
    }

    if (entityType && entityId && entityTitle) {
      await this.prisma.holidayAuditLog.create({
        data: {
          organization_id: orgId,
          entity_type: entityType,
          entity_id: entityId,
          entity_title: entityTitle,
          original_date: date,
          adjusted_date: adjusted,
          action_taken: auditAction,
          holiday_name: holidayName,
          holiday_date: date,
          year: date.getFullYear(),
        },
      })
    }

    return adjusted
  }

  private async getHolidayNameForDate(date: Date, orgId: string, deptId?: string, userId?: string): Promise<string> {
    // Check org holidays first
    const orgHolidays = await this.prisma.orgHoliday.findMany({
      where: { organization_id: orgId, status: HolidayStatus.active },
    })
    const orgMatch = orgHolidays.find((h) => this.dateMatchesHoliday(date, h))
    if (orgMatch) return orgMatch.name

    if (deptId) {
      const deptHolidays = await this.resolveDeptHolidays(orgId, deptId, { activeOnly: true })
      const deptMatch = deptHolidays.find((h) => this.dateMatchesHoliday(date, h))
      if (deptMatch) return deptMatch.name
    }

    if (userId) {
      const userHolidays = await this.prisma.individualHoliday.findMany({
        where: { organization_id: orgId, user_id: userId },
      })
      const userMatch = userHolidays.find((h) => this.dateMatchesHoliday(date, h))
      if (userMatch) return userMatch.name
    }

    // Check if it's a weekend
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const master = await this.prisma.holidayMaster.findUnique({ where: { organization_id: orgId } })
    const wd = await this.prisma.orgWorkingDays.findUnique({ where: { organization_id: orgId } })
    const workingDays = (wd?.working_days as number[]) ?? [1, 2, 3, 4, 5]
    if (!workingDays.includes(date.getDay())) return `${dayNames[date.getDay()]} (non-working day)`

    return 'Holiday'
  }

  async getNextWorkingDay(date: Date, orgId: string, deptId?: string, userId?: string): Promise<Date> {
    const d = new Date(date)
    for (let i = 0; i < 30; i++) {
      d.setDate(d.getDate() + 1)
      if (await this.isWorkingDay(d, orgId, deptId, userId)) return d
    }
    return d
  }

  async getPrevWorkingDay(date: Date, orgId: string, deptId?: string, userId?: string): Promise<Date> {
    const d = new Date(date)
    for (let i = 0; i < 30; i++) {
      d.setDate(d.getDate() - 1)
      if (await this.isWorkingDay(d, orgId, deptId, userId)) return d
    }
    return d
  }

  // ─── Range query ──────────────────────────────────────────────────────────────

  async getHolidaysInRange(orgId: string, from: Date, to: Date, deptId?: string, userId?: string) {
    const results: { date: string; name: string; level: string; type: string }[] = []
    const d = new Date(from)
    while (d <= to) {
      const isWorking = await this.isWorkingDay(d, orgId, deptId, userId)
      if (!isWorking) {
        const name = await this.getHolidayNameForDate(d, orgId, deptId, userId)
        results.push({
          date: d.toISOString().slice(0, 10),
          name,
          level: 'org',
          type: 'national',
        })
      }
      d.setDate(d.getDate() + 1)
    }
    return results
  }

  // ─── Date check utility ────────────────────────────────────────────────────────

  async checkDate(orgId: string, date: Date, deptId?: string, userId?: string) {
    await this.ensureDefaults(orgId)
    const isWorking = await this.isWorkingDay(date, orgId, deptId, userId)
    const master = await this.prisma.holidayMaster.findUnique({ where: { organization_id: orgId } })
    const action = master?.holiday_on_task_action ?? HolidayOnTaskAction.move_to_next_working_day

    let adjustedDate: string | null = null
    let reason = 'Working day'
    let actionStr = 'none'

    if (!isWorking) {
      const holidayName = await this.getHolidayNameForDate(date, orgId, deptId, userId)
      reason = holidayName
      switch (action) {
        case HolidayOnTaskAction.skip_create:
          adjustedDate = null
          actionStr = 'skip_create'
          break
        case HolidayOnTaskAction.create_anyway:
          adjustedDate = date.toISOString().slice(0, 10)
          actionStr = 'create_anyway'
          break
        case HolidayOnTaskAction.move_to_prev_working_day: {
          const prev = await this.getPrevWorkingDay(date, orgId, deptId, userId)
          adjustedDate = prev.toISOString().slice(0, 10)
          actionStr = 'move_to_prev_working_day'
          break
        }
        default: {
          const next = await this.getNextWorkingDay(date, orgId, deptId, userId)
          adjustedDate = next.toISOString().slice(0, 10)
          actionStr = 'move_to_next_working_day'
          break
        }
      }
    }

    return {
      is_working_day: isWorking,
      reason,
      adjusted_date: adjustedDate,
      action: actionStr,
    }
  }

  // ─── Bulk CSV import ─────────────────────────────────────────────────────────

  async bulkImportOrgHolidays(orgId: string, holidays: Array<{
    name: string
    date: string
    type?: string
    is_recurring_yearly?: boolean
    description?: string
  }>) {
    let imported = 0
    let skipped = 0
    for (const h of holidays) {
      const date = new Date(h.date)
      if (isNaN(date.getTime())) { skipped++; continue }
      const year = date.getFullYear()
      const existing = await this.prisma.orgHoliday.findFirst({
        where: { organization_id: orgId, date, name: h.name },
      })
      if (existing) { skipped++; continue }
      const type = (['national', 'company', 'regional'].includes(h.type ?? '') ? h.type : 'national') as HolidayType
      await this.prisma.orgHoliday.create({
        data: {
          organization_id: orgId,
          name: h.name,
          date,
          type,
          source: 'manual',
          status: HolidayStatus.active,
          year,
          is_recurring_yearly: h.is_recurring_yearly ?? false,
          description: h.description || null,
        },
      })
      imported++
    }
    return { imported, skipped }
  }

  // ─── Org working days & holidays ─────────────────────────────────────────────

  async getOrgWorkingDays(orgId: string) {
    await this.ensureDefaults(orgId)
    return this.prisma.orgWorkingDays.findUnique({ where: { organization_id: orgId } })
  }

  async updateOrgWorkingDays(orgId: string, dto: UpdateWorkingDaysDto) {
    await this.ensureDefaults(orgId)
    return this.prisma.orgWorkingDays.update({
      where: { organization_id: orgId },
      data: { working_days: dto.working_days as never },
    })
  }

  async listOrgHolidays(orgId: string, year?: number, type?: HolidayType, status?: HolidayStatus) {
    return this.prisma.orgHoliday.findMany({
      where: {
        organization_id: orgId,
        ...(year && { year }),
        ...(type && { type }),
        ...(status && { status }),
      },
      orderBy: { date: 'asc' },
    })
  }

  async createOrgHoliday(orgId: string, dto: CreateOrgHolidayDto) {
    const date = new Date(dto.date)
    // Only keep an end date when it's a genuine range (strictly after the start).
    const endDate = dto.end_date ? new Date(dto.end_date) : null
    const end = endDate && endDate.getTime() > date.getTime() ? endDate : null
    return this.prisma.orgHoliday.create({
      data: {
        organization_id: orgId,
        name: dto.name,
        date,
        end_date: end,
        type: dto.type,
        description: dto.description,
        is_recurring_yearly: dto.is_recurring_yearly ?? false,
        status: HolidayStatus.active,
        year: date.getFullYear(),
      },
    })
  }

  async updateOrgHoliday(orgId: string, id: string, dto: UpdateOrgHolidayDto) {
    await this.findOrgHolidayOrFail(orgId, id)
    const date = dto.date ? new Date(dto.date) : undefined
    const endDate = dto.end_date ? new Date(dto.end_date) : undefined
    return this.prisma.orgHoliday.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(date && { date, year: date.getFullYear() }),
        ...(dto.end_date !== undefined && { end_date: endDate ?? null }),
        ...(dto.type && { type: dto.type }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.is_recurring_yearly !== undefined && { is_recurring_yearly: dto.is_recurring_yearly }),
      },
    })
  }

  async deleteOrgHoliday(orgId: string, id: string) {
    await this.findOrgHolidayOrFail(orgId, id)
    await this.prisma.orgHoliday.delete({ where: { id } })
    return { ok: true }
  }

  private async findOrgHolidayOrFail(orgId: string, id: string) {
    const h = await this.prisma.orgHoliday.findFirst({ where: { id, organization_id: orgId } })
    if (!h) throw new NotFoundException(`Holiday ${id} not found`)
    return h
  }

  // ─── Dept working days & holidays ────────────────────────────────────────────

  async getDeptWorkingDays(orgId: string, deptId: string) {
    return this.prisma.departmentWorkingDays.findUnique({
      where: { organization_id_department_id: { organization_id: orgId, department_id: deptId } },
    })
  }

  async upsertDeptWorkingDays(orgId: string, deptId: string, dto: UpdateWorkingDaysDto) {
    return this.prisma.departmentWorkingDays.upsert({
      where: { organization_id_department_id: { organization_id: orgId, department_id: deptId } },
      create: { organization_id: orgId, department_id: deptId, working_days: dto.working_days as never },
      update: { working_days: dto.working_days as never },
    })
  }

  async deleteDeptWorkingDays(orgId: string, deptId: string) {
    const existing = await this.prisma.departmentWorkingDays.findUnique({
      where: { organization_id_department_id: { organization_id: orgId, department_id: deptId } },
    })
    if (!existing) return { ok: true }
    await this.prisma.departmentWorkingDays.delete({
      where: { organization_id_department_id: { organization_id: orgId, department_id: deptId } },
    })
    return { ok: true }
  }

  /** Org departments as the lightweight tree shape used for cascade resolution. */
  private async getDeptNodes(orgId: string): Promise<DeptNode[]> {
    const rows = await this.prisma.department.findMany({
      where: { organization_id: orgId },
      select: { id: true, parent_department_id: true },
    })
    return rows.map((r) => ({ id: r.id, parent_department_id: r.parent_department_id }))
  }

  /**
   * The effective holidays for a department: its own holidays plus any inherited
   * from ancestor departments (by link, not copy), minus locally opted-out ones.
   *
   * An ancestor holiday H reaches this department only if the department is in
   * H's target set (the checked cascade list). It is then dropped if an opt-out
   * sits anywhere on the path from H's origin down to this department — that is
   * what makes opt-out flow DOWN only and never affect siblings or the parent.
   *
   * This single resolver feeds both the calendar UI and the scheduling engine.
   */
  private async resolveDeptHolidays(
    orgId: string,
    deptId: string,
    opts: { activeOnly?: boolean } = {},
  ): Promise<ResolvedDeptHoliday[]> {
    const statusFilter = opts.activeOnly ? { status: HolidayStatus.active } : {}

    const [deptRows, ownRows] = await Promise.all([
      this.prisma.department.findMany({
        where: { organization_id: orgId },
        select: {
          id: true,
          name: true,
          parent_department_id: true,
          head_user_id: true,
          head_user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.departmentHoliday.findMany({
        where: { organization_id: orgId, department_id: deptId, ...statusFilter },
        include: { _count: { select: { targets: true } } },
      }),
    ])

    const nodes: DeptNode[] = deptRows.map((d) => ({ id: d.id, parent_department_id: d.parent_department_id }))
    const deptById = new Map(deptRows.map((d) => [d.id, d]))
    const chain = ancestorChain(nodes, deptId) // root → … → self
    const originIds = chain.slice(0, -1) // every ancestor, any depth

    const out: ResolvedDeptHoliday[] = ownRows.map((h) => ({
      ...h,
      inherited: false,
      source_department_id: null,
      source_department_name: null,
      source_department_head_user_id: null,
      source_department_head_name: null,
      cascade_target_count: h._count.targets,
    }))

    if (originIds.length) {
      const candidates = await this.prisma.departmentHoliday.findMany({
        where: { organization_id: orgId, department_id: { in: originIds }, ...statusFilter },
        include: { targets: true, opt_outs: true },
      })

      for (const h of candidates) {
        // Reaches this department only if it is a target and no opt-out sits on
        // the path from origin down to here (down-only detach). See holidayReaches.
        const reaches = holidayReaches(chain, deptId, {
          originId: h.department_id,
          targetIds: h.targets.map((t) => t.department_id),
          optOutIds: h.opt_outs.map((o) => o.department_id),
        })
        if (!reaches) continue

        const src = deptById.get(h.department_id)
        out.push({
          id: h.id,
          organization_id: h.organization_id,
          department_id: h.department_id,
          name: h.name,
          date: h.date,
          end_date: h.end_date,
          type: h.type,
          is_recurring_yearly: h.is_recurring_yearly,
          description: h.description,
          status: h.status,
          year: h.year,
          created_at: h.created_at,
          updated_at: h.updated_at,
          inherited: true,
          source_department_id: h.department_id,
          source_department_name: src?.name ?? null,
          source_department_head_user_id: src?.head_user_id ?? null,
          source_department_head_name: src?.head_user?.name ?? null,
          cascade_target_count: 0,
        })
      }
    }

    out.sort((a, b) => a.date.getTime() - b.date.getTime())
    return out
  }

  /** Keep only ids that are genuine descendants of the origin department. */
  private async validTargetIds(orgId: string, originDeptId: string, ids?: string[]): Promise<string[]> {
    if (!ids?.length) return []
    const descendants = descendantIds(await this.getDeptNodes(orgId), originDeptId)
    return Array.from(new Set(ids.filter((id) => descendants.has(id))))
  }

  async listDeptHolidays(orgId: string, deptId: string, year?: number) {
    const resolved = await this.resolveDeptHolidays(orgId, deptId)
    // Match by exact year, but always surface recurring-yearly holidays.
    return year ? resolved.filter((h) => h.year === year || h.is_recurring_yearly) : resolved
  }

  async createDeptHoliday(orgId: string, deptId: string, dto: CreateDepartmentHolidayDto) {
    const date = new Date(dto.date)
    const endDate = dto.end_date ? new Date(dto.end_date) : null
    const end = endDate && endDate.getTime() > date.getTime() ? endDate : null
    const holiday = await this.prisma.departmentHoliday.create({
      data: {
        organization_id: orgId,
        department_id: deptId,
        name: dto.name,
        date,
        end_date: end,
        type: dto.type,
        description: dto.description,
        is_recurring_yearly: dto.is_recurring_yearly ?? false,
        status: HolidayStatus.active,
        year: date.getFullYear(),
      },
    })

    const targets = await this.validTargetIds(orgId, deptId, dto.target_department_ids)
    if (targets.length) {
      await this.prisma.departmentHolidayTarget.createMany({
        data: targets.map((department_id) => ({ organization_id: orgId, holiday_id: holiday.id, department_id })),
        skipDuplicates: true,
      })
    }
    return holiday
  }

  async updateDeptHoliday(orgId: string, deptId: string, id: string, dto: UpdateDepartmentHolidayDto) {
    const existing = await this.prisma.departmentHoliday.findFirst({ where: { id, organization_id: orgId, department_id: deptId } })
    if (!existing) throw new NotFoundException(`Department holiday ${id} not found`)
    const date = dto.date ? new Date(dto.date) : undefined
    const endDate = dto.end_date ? new Date(dto.end_date) : undefined
    const updated = await this.prisma.departmentHoliday.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(date && { date, year: date.getFullYear() }),
        ...(dto.end_date !== undefined && { end_date: endDate ?? null }),
        ...(dto.type && { type: dto.type }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.is_recurring_yearly !== undefined && { is_recurring_yearly: dto.is_recurring_yearly }),
      },
    })

    // Replace the cascade reach wholesale when the caller sends a target list.
    if (dto.target_department_ids !== undefined) {
      const targets = await this.validTargetIds(orgId, deptId, dto.target_department_ids)
      await this.prisma.departmentHolidayTarget.deleteMany({ where: { holiday_id: id } })
      if (targets.length) {
        await this.prisma.departmentHolidayTarget.createMany({
          data: targets.map((department_id) => ({ organization_id: orgId, holiday_id: id, department_id })),
          skipDuplicates: true,
        })
      }
    }
    return updated
  }

  async deleteDeptHoliday(orgId: string, deptId: string, id: string) {
    const existing = await this.prisma.departmentHoliday.findFirst({ where: { id, organization_id: orgId, department_id: deptId } })
    if (!existing) throw new NotFoundException(`Department holiday ${id} not found`)
    await this.prisma.departmentHoliday.delete({ where: { id } }) // targets + opt-outs cascade
    return { ok: true }
  }

  // ─── Cascade opt-out (local detach of an inherited holiday) ───────────────────

  /**
   * Opt a department out of an inherited holiday. The detach applies to this
   * department and its descendants only — parent and siblings keep the holiday.
   * The SOURCE department's head (the cascade origin) is notified, and the
   * action is written to the shared audit log.
   */
  async optOutDeptHoliday(orgId: string, deptId: string, holidayId: string, actorId: string) {
    const holiday = await this.prisma.departmentHoliday.findFirst({ where: { id: holidayId, organization_id: orgId } })
    if (!holiday) throw new NotFoundException(`Department holiday ${holidayId} not found`)
    if (holiday.department_id === deptId) {
      throw new BadRequestException('Cannot opt out of a holiday this department owns — delete it instead.')
    }
    const target = await this.prisma.departmentHolidayTarget.findUnique({
      where: { holiday_id_department_id: { holiday_id: holidayId, department_id: deptId } },
    })
    if (!target) throw new BadRequestException('This holiday is not inherited by this department.')

    await this.prisma.departmentHolidayOptOut.upsert({
      where: { holiday_id_department_id: { holiday_id: holidayId, department_id: deptId } },
      create: { organization_id: orgId, holiday_id: holidayId, department_id: deptId, opted_out_by_user_id: actorId },
      update: {},
    })

    const [optingDept, sourceDept] = await Promise.all([
      this.prisma.department.findUnique({ where: { id: deptId }, select: { name: true } }),
      this.prisma.department.findUnique({
        where: { id: holiday.department_id },
        select: { name: true, head_user_id: true },
      }),
    ])
    const optingName = optingDept?.name ?? 'A department'
    const sourceName = sourceDept?.name ?? 'the source department'

    await this.audit.record({
      orgId,
      actorId,
      action: 'update',
      resource: 'department_holiday',
      entityId: holidayId,
      entityLabel: holiday.name,
      changes: { opted_out_by_department: { before: null, after: `${optingName} (${deptId})` } },
    })

    // Notify the SOURCE department's head — it's their holiday being declined.
    if (sourceDept?.head_user_id && sourceDept.head_user_id !== actorId) {
      await this.notifications.emit({
        orgId,
        module: 'system',
        event_type: 'holiday_opted_out',
        recipients: [sourceDept.head_user_id],
        title: 'Department opted out of a holiday',
        body: `${optingName} opted out of "${holiday.name}" (cascaded from ${sourceName}). It still applies to ${sourceName} and all other departments.`,
        link: '/settings/organization/holidays/departments',
        entity: { type: 'department_holiday', id: holidayId },
      })
    }

    return { ok: true }
  }

  /** Reverse a local opt-out (re-attach the inherited holiday for this department). */
  async undoOptOutDeptHoliday(orgId: string, deptId: string, holidayId: string, actorId: string) {
    const holiday = await this.prisma.departmentHoliday.findFirst({ where: { id: holidayId, organization_id: orgId } })
    if (!holiday) throw new NotFoundException(`Department holiday ${holidayId} not found`)

    const removed = await this.prisma.departmentHolidayOptOut.deleteMany({
      where: { holiday_id: holidayId, department_id: deptId },
    })
    if (removed.count > 0) {
      const optingDept = await this.prisma.department.findUnique({ where: { id: deptId }, select: { name: true } })
      await this.audit.record({
        orgId,
        actorId,
        action: 'update',
        resource: 'department_holiday',
        entityId: holidayId,
        entityLabel: holiday.name,
        changes: { opted_out_by_department: { before: `${optingDept?.name ?? deptId} (${deptId})`, after: null } },
      })
    }
    return { ok: true }
  }

  // ─── Individual working days & holidays ──────────────────────────────────────

  async listUserWorkingDays(orgId: string, userId: string) {
    return this.prisma.individualWorkingDays.findMany({
      where: { organization_id: orgId, user_id: userId },
      orderBy: { effective_from: 'desc' },
    })
  }

  async createUserWorkingDays(orgId: string, userId: string, dto: CreateIndividualWorkingDaysDto) {
    return this.prisma.individualWorkingDays.create({
      data: {
        organization_id: orgId,
        user_id: userId,
        working_days: dto.working_days as never,
        effective_from: new Date(dto.effective_from),
        effective_to: dto.effective_to ? new Date(dto.effective_to) : null,
      },
    })
  }

  async updateUserWorkingDays(orgId: string, userId: string, id: string, dto: UpdateIndividualWorkingDaysDto) {
    const existing = await this.prisma.individualWorkingDays.findFirst({ where: { id, organization_id: orgId, user_id: userId } })
    if (!existing) throw new NotFoundException(`Working days schedule ${id} not found`)
    return this.prisma.individualWorkingDays.update({
      where: { id },
      data: {
        ...(dto.working_days && { working_days: dto.working_days as never }),
        ...(dto.effective_from && { effective_from: new Date(dto.effective_from) }),
        ...(dto.effective_to !== undefined && { effective_to: dto.effective_to ? new Date(dto.effective_to) : null }),
      },
    })
  }

  async deleteUserWorkingDays(orgId: string, userId: string, id: string) {
    const existing = await this.prisma.individualWorkingDays.findFirst({ where: { id, organization_id: orgId, user_id: userId } })
    if (!existing) throw new NotFoundException(`Working days schedule ${id} not found`)
    await this.prisma.individualWorkingDays.delete({ where: { id } })
    return { ok: true }
  }

  async listUserHolidays(orgId: string, userId: string, year?: number) {
    return this.prisma.individualHoliday.findMany({
      where: { organization_id: orgId, user_id: userId, ...(year && { year }) },
      orderBy: { date: 'asc' },
    })
  }

  async createUserHoliday(orgId: string, userId: string, dto: CreateIndividualHolidayDto) {
    const date = new Date(dto.date)
    return this.prisma.individualHoliday.create({
      data: {
        organization_id: orgId,
        user_id: userId,
        name: dto.name,
        date,
        type: dto.type,
        description: dto.description,
        is_recurring_yearly: dto.is_recurring_yearly ?? false,
        year: date.getFullYear(),
      },
    })
  }

  async updateUserHoliday(orgId: string, userId: string, id: string, dto: UpdateIndividualHolidayDto) {
    const existing = await this.prisma.individualHoliday.findFirst({ where: { id, organization_id: orgId, user_id: userId } })
    if (!existing) throw new NotFoundException(`Individual holiday ${id} not found`)
    const date = dto.date ? new Date(dto.date) : undefined
    return this.prisma.individualHoliday.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(date && { date, year: date.getFullYear() }),
        ...(dto.type && { type: dto.type }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.is_recurring_yearly !== undefined && { is_recurring_yearly: dto.is_recurring_yearly }),
      },
    })
  }

  async deleteUserHoliday(orgId: string, userId: string, id: string) {
    const existing = await this.prisma.individualHoliday.findFirst({ where: { id, organization_id: orgId, user_id: userId } })
    if (!existing) throw new NotFoundException(`Individual holiday ${id} not found`)
    await this.prisma.individualHoliday.delete({ where: { id } })
    return { ok: true }
  }

  // ─── Audit log ────────────────────────────────────────────────────────────────

  async getAuditLog(orgId: string, filters: { year?: number; entity_type?: HolidayEntityType; from?: string; to?: string }) {
    return this.prisma.holidayAuditLog.findMany({
      where: {
        organization_id: orgId,
        ...(filters.year && { year: filters.year }),
        ...(filters.entity_type && { entity_type: filters.entity_type }),
        ...(filters.from && { created_at: { gte: new Date(filters.from) } }),
        ...(filters.to && { created_at: { lte: new Date(filters.to) } }),
      },
      orderBy: { created_at: 'desc' },
    })
  }
}
