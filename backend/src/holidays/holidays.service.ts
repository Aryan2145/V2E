import { Injectable, NotFoundException } from '@nestjs/common'
import { HolidayOnTaskAction, HolidayAuditAction, HolidayEntityType, HolidayStatus, HolidayType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { NagerService, type NagerHoliday, type NagerCountry } from './nager.service'
import type { UpdateHolidayMasterDto } from './dto/update-holiday-master.dto'
import type { UpdateWorkingDaysDto } from './dto/update-working-days.dto'
import type { CreateOrgHolidayDto, UpdateOrgHolidayDto } from './dto/create-org-holiday.dto'
import type { CreateDepartmentHolidayDto, UpdateDepartmentHolidayDto } from './dto/create-department-holiday.dto'
import type { CreateIndividualHolidayDto, UpdateIndividualHolidayDto, CreateIndividualWorkingDaysDto, UpdateIndividualWorkingDaysDto } from './dto/create-individual-holiday.dto'

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nager: NagerService,
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
        ...(dto.org_holiday_manage_roles && { org_holiday_manage_roles: dto.org_holiday_manage_roles as never }),
        ...(dto.dept_holiday_manage_roles && { dept_holiday_manage_roles: dto.dept_holiday_manage_roles as never }),
        ...(dto.individual_holiday_manage_roles && { individual_holiday_manage_roles: dto.individual_holiday_manage_roles as never }),
      },
    })
    // If country_code changed (or first set), fetch holidays as pending
    if (dto.country_code && dto.country_code !== prev?.country_code && dto.country_code !== null) {
      const year = new Date().getFullYear()
      await this.fetchAndPendHolidaysForOrg(orgId, year).catch(() => { /* non-blocking */ })
    }
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
    const holidays = await this.prisma.departmentHoliday.findMany({
      where: { organization_id: orgId, department_id: deptId, status: HolidayStatus.active },
    })
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

  private matchesAnyHoliday(date: Date, holidays: { date: Date; is_recurring_yearly: boolean }[]): boolean {
    return holidays.some((h) => {
      const hd = new Date(h.date)
      if (h.is_recurring_yearly) {
        return hd.getMonth() === date.getMonth() && hd.getDate() === date.getDate()
      }
      return hd.getFullYear() === date.getFullYear() &&
        hd.getMonth() === date.getMonth() &&
        hd.getDate() === date.getDate()
    })
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
    const orgMatch = orgHolidays.find((h) => {
      const hd = new Date(h.date)
      if (h.is_recurring_yearly) return hd.getMonth() === date.getMonth() && hd.getDate() === date.getDate()
      return hd.getFullYear() === date.getFullYear() && hd.getMonth() === date.getMonth() && hd.getDate() === date.getDate()
    })
    if (orgMatch) return orgMatch.name

    if (deptId) {
      const deptHolidays = await this.prisma.departmentHoliday.findMany({
        where: { organization_id: orgId, department_id: deptId, status: HolidayStatus.active },
      })
      const deptMatch = deptHolidays.find((h) => {
        const hd = new Date(h.date)
        if (h.is_recurring_yearly) return hd.getMonth() === date.getMonth() && hd.getDate() === date.getDate()
        return hd.getFullYear() === date.getFullYear() && hd.getMonth() === date.getMonth() && hd.getDate() === date.getDate()
      })
      if (deptMatch) return deptMatch.name
    }

    if (userId) {
      const userHolidays = await this.prisma.individualHoliday.findMany({
        where: { organization_id: orgId, user_id: userId },
      })
      const userMatch = userHolidays.find((h) => {
        const hd = new Date(h.date)
        if (h.is_recurring_yearly) return hd.getMonth() === date.getMonth() && hd.getDate() === date.getDate()
        return hd.getFullYear() === date.getFullYear() && hd.getMonth() === date.getMonth() && hd.getDate() === date.getDate()
      })
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

  // ─── Nager integration ────────────────────────────────────────────────────────

  async getAvailableCountries(): Promise<NagerCountry[]> {
    return this.nager.getAvailableCountries()
  }

  async fetchNationalHolidaysPreview(orgId: string, year: number) {
    const master = await this.prisma.holidayMaster.findUnique({ where: { organization_id: orgId } })
    if (!master?.country_code) throw new NotFoundException('Country code not set. Please configure country in Holiday Settings.')
    return this.nager.getPublicHolidays(master.country_code, year)
  }

  async importNationalHolidays(orgId: string, year: number, holidays: NagerHoliday[]) {
    let imported = 0
    for (const h of holidays) {
      const date = new Date(h.date)
      const existing = await this.prisma.orgHoliday.findFirst({
        where: { organization_id: orgId, date, name: h.name },
      })
      if (existing) continue
      await this.prisma.orgHoliday.create({
        data: {
          organization_id: orgId,
          name: h.name,
          date,
          type: HolidayType.national,
          source: 'nager_date',
          status: HolidayStatus.active,
          year,
        },
      })
      imported++
    }
    return { imported }
  }

  async fetchAndPendHolidaysForOrg(orgId: string, year: number) {
    const master = await this.prisma.holidayMaster.findUnique({ where: { organization_id: orgId } })
    if (!master?.country_code) return { created: 0 }

    const holidays = await this.nager.getPublicHolidays(master.country_code, year)
    let created = 0
    for (const h of holidays) {
      const date = new Date(h.date)
      const existing = await this.prisma.orgHoliday.findFirst({
        where: { organization_id: orgId, date, name: h.name },
      })
      if (existing) continue
      await this.prisma.orgHoliday.create({
        data: {
          organization_id: orgId,
          name: h.name,
          date,
          type: HolidayType.national,
          source: 'nager_date',
          status: HolidayStatus.pending_review,
          year,
        },
      })
      created++
    }
    return { created }
  }

  async getPendingHolidays(orgId: string, year: number) {
    return this.prisma.orgHoliday.findMany({
      where: { organization_id: orgId, status: HolidayStatus.pending_review, year },
      orderBy: { date: 'asc' },
    })
  }

  async applyPendingHolidays(orgId: string, year: number, selectedIds?: string[]) {
    if (selectedIds && selectedIds.length > 0) {
      await this.prisma.orgHoliday.updateMany({
        where: { organization_id: orgId, year, status: HolidayStatus.pending_review, id: { in: selectedIds } },
        data: { status: HolidayStatus.active },
      })
      await this.prisma.orgHoliday.deleteMany({
        where: { organization_id: orgId, year, status: HolidayStatus.pending_review, id: { notIn: selectedIds } },
      })
    } else {
      await this.prisma.orgHoliday.updateMany({
        where: { organization_id: orgId, year, status: HolidayStatus.pending_review },
        data: { status: HolidayStatus.active },
      })
    }
    return { ok: true }
  }

  async dismissPendingHolidays(orgId: string, year: number) {
    await this.prisma.orgHoliday.deleteMany({
      where: { organization_id: orgId, year, status: HolidayStatus.pending_review },
    })
    return { ok: true }
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
    return this.prisma.orgHoliday.create({
      data: {
        organization_id: orgId,
        name: dto.name,
        date,
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
    return this.prisma.orgHoliday.update({
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

  async listDeptHolidays(orgId: string, deptId: string, year?: number) {
    return this.prisma.departmentHoliday.findMany({
      where: { organization_id: orgId, department_id: deptId, ...(year && { year }) },
      orderBy: { date: 'asc' },
    })
  }

  async createDeptHoliday(orgId: string, deptId: string, dto: CreateDepartmentHolidayDto) {
    const date = new Date(dto.date)
    return this.prisma.departmentHoliday.create({
      data: {
        organization_id: orgId,
        department_id: deptId,
        name: dto.name,
        date,
        type: dto.type,
        description: dto.description,
        is_recurring_yearly: dto.is_recurring_yearly ?? false,
        status: HolidayStatus.active,
        year: date.getFullYear(),
      },
    })
  }

  async updateDeptHoliday(orgId: string, deptId: string, id: string, dto: UpdateDepartmentHolidayDto) {
    const existing = await this.prisma.departmentHoliday.findFirst({ where: { id, organization_id: orgId, department_id: deptId } })
    if (!existing) throw new NotFoundException(`Department holiday ${id} not found`)
    const date = dto.date ? new Date(dto.date) : undefined
    return this.prisma.departmentHoliday.update({
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

  async deleteDeptHoliday(orgId: string, deptId: string, id: string) {
    const existing = await this.prisma.departmentHoliday.findFirst({ where: { id, organization_id: orgId, department_id: deptId } })
    if (!existing) throw new NotFoundException(`Department holiday ${id} not found`)
    await this.prisma.departmentHoliday.delete({ where: { id } })
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
