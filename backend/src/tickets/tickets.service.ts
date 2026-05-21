import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import type { RaiseTicketDto } from './dto/raise-ticket.dto'
import type { UpdateTicketDto } from './dto/update-ticket.dto'
import type { AssignTicketDto } from './dto/assign-ticket.dto'
import type { ResolveTicketDto } from './dto/resolve-ticket.dto'
import type { CloseTicketDto } from './dto/close-ticket.dto'
import type { RateTicketDto } from './dto/rate-ticket.dto'
import type { AddTicketCommentDto } from './dto/add-comment.dto'
import type { CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/create-ticket-type.dto'
import type { CreateTicketCategoryDto, UpdateTicketCategoryDto } from './dto/create-ticket-category.dto'
import type { CreateTicketPriorityDto, UpdateTicketPriorityDto } from './dto/create-ticket-priority.dto'
import type { CreateTicketStatusDto, UpdateTicketStatusDto, ReorderTicketStatusesDto } from './dto/create-ticket-status.dto'
import type { CreateTicketTemplateDto, UpdateTicketTemplateDto } from './dto/create-ticket-template.dto'
import type { UpdateTicketMasterDto } from './dto/update-ticket-master.dto'

const TICKET_INCLUDE = {
  ticket_type: true,
  category: true,
  priority: true,
  status: true,
  checklist: { orderBy: { order_index: 'asc' as const } },
  escalations: { orderBy: { level: 'asc' as const } },
}

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Defaults ──────────────────────────────────────────────────────────────

  async ensureDefaults(orgId: string) {
    const existing = await this.prisma.ticketMaster.findUnique({ where: { organization_id: orgId } })
    if (existing) return existing

    await this.prisma.ticketMaster.create({ data: { organization_id: orgId } })

    const defaultTypes = [
      { name: 'Issue', color: '#2563EB', icon: '🐛', default_sla_days: 3, order_index: 0 },
      { name: 'Service Request', color: '#0891B2', icon: '🛎️', default_sla_days: 5, order_index: 1 },
      { name: 'Complaint', color: '#DC2626', icon: '📢', default_sla_days: 7, order_index: 2 },
      { name: 'Query', color: '#D97706', icon: '❓', default_sla_days: 2, order_index: 3 },
    ]
    for (const t of defaultTypes) {
      await this.prisma.ticketType.create({ data: { organization_id: orgId, ...t } })
    }

    const defaultPriorities = [
      { label: 'Critical', color: '#DC2626', sla_days: 1, order_index: 0 },
      { label: 'High', color: '#D97706', sla_days: 2, order_index: 1 },
      { label: 'Medium', color: '#2563EB', sla_days: 5, order_index: 2 },
      { label: 'Low', color: '#475569', sla_days: 10, order_index: 3 },
    ]
    for (const p of defaultPriorities) {
      await this.prisma.ticketPriority.create({ data: { organization_id: orgId, ...p } })
    }

    const defaultStatuses = [
      { label: 'Open', type: 'open' as const, color: '#2563EB', order_index: 0, is_default: true },
      { label: 'Assigned', type: 'assigned' as const, color: '#0891B2', order_index: 1 },
      { label: 'Accepted & In Progress', type: 'in_progress' as const, color: '#D97706', order_index: 2 },
      { label: 'Resolved', type: 'resolved' as const, color: '#16A34A', order_index: 3 },
      { label: 'Closed — Resolved', type: 'closed_resolved' as const, color: '#15803D', order_index: 4 },
      { label: 'Closed — Unresolved', type: 'closed_unresolved' as const, color: '#DC2626', order_index: 5 },
    ]
    for (const s of defaultStatuses) {
      await this.prisma.ticketStatus.create({ data: { organization_id: orgId, ...s } })
    }

    return this.prisma.ticketMaster.findUnique({ where: { organization_id: orgId } })
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async logActivity(
    orgId: string,
    ticketId: string,
    userId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.ticketActivityLog.create({
      data: {
        organization_id: orgId,
        ticket_id: ticketId,
        performed_by_user_id: userId,
        action: action as never,
        metadata: metadata as never,
      },
    })
  }

  private async notifyUser(orgId: string, ticketId: string | null, userId: string, type: string, message: string) {
    await this.prisma.ticketNotification.create({
      data: { organization_id: orgId, ticket_id: ticketId, user_id: userId, type, message },
    })
  }

  private async notifyUsers(orgId: string, ticketId: string | null, userIds: string[], type: string, message: string) {
    if (userIds.length === 0) return
    await this.prisma.ticketNotification.createMany({
      data: userIds.map((userId) => ({ organization_id: orgId, ticket_id: ticketId, user_id: userId, type, message })),
    })
  }

  private async getStatusByType(orgId: string, type: string) {
    const status = await this.prisma.ticketStatus.findFirst({ where: { organization_id: orgId, type: type as never } })
    if (!status) throw new BadRequestException(`Status type "${type}" not found. Run GET /tickets/masters/config first.`)
    return status
  }

  private async generateTicketNumber(orgId: string): Promise<string> {
    const last = await this.prisma.ticket.findFirst({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
      select: { ticket_number: true },
    })
    const n = last ? parseInt(last.ticket_number.replace('TKT-', '')) + 1 : 1
    return `TKT-${n.toString().padStart(4, '0')}`
  }

  private resolveSlaFromConfigs(
    typeSla: number,
    categorySla?: number | null,
    prioritySla?: number | null,
  ): number {
    return prioritySla ?? categorySla ?? typeSla
  }

  private async resolveAutoAssignee(
    orgId: string,
    typeId: string,
    categoryId?: string,
    templateId?: string,
  ): Promise<string | null> {
    if (templateId) {
      const tmpl = await this.prisma.ticketTemplate.findUnique({ where: { id: templateId } })
      if (tmpl?.auto_assign_user_id) return tmpl.auto_assign_user_id
      if (tmpl?.auto_assign_role) {
        const u = await this.resolveRoleRoundRobin(orgId, 'ticket_template', templateId, tmpl.auto_assign_role)
        if (u) return u
      }
    }
    if (categoryId) {
      const cat = await this.prisma.ticketCategory.findUnique({ where: { id: categoryId } })
      if (cat?.auto_assign_user_id) return cat.auto_assign_user_id
      if (cat?.auto_assign_role) {
        const u = await this.resolveRoleRoundRobin(orgId, 'ticket_category', categoryId, cat.auto_assign_role)
        if (u) return u
      }
    }
    const type = await this.prisma.ticketType.findUnique({ where: { id: typeId } })
    if (type?.auto_assign_user_id) return type.auto_assign_user_id
    if (type?.auto_assign_role) {
      const u = await this.resolveRoleRoundRobin(orgId, 'ticket_type', typeId, type.auto_assign_role)
      if (u) return u
    }
    return null
  }

  private async resolveRoleRoundRobin(
    orgId: string,
    scopeType: string,
    scopeId: string,
    role: string,
  ): Promise<string | null> {
    const members = await this.prisma.organizationMember.findMany({
      where: { organization_id: orgId, role: role as never, is_active: true },
      select: { user_id: true },
      orderBy: { joined_at: 'asc' },
    })
    if (members.length === 0) return null
    const userIds = members.map((m) => m.user_id)
    const tracker = await this.prisma.ticketRoundRobinTracker.findUnique({
      where: { scope_type_scope_id_role: { scope_type: scopeType, scope_id: scopeId, role } },
    })
    let nextIdx = 0
    if (tracker) {
      const lastIdx = userIds.indexOf(tracker.last_assigned_user_id)
      nextIdx = (lastIdx + 1) % userIds.length
    }
    const assignedUserId = userIds[nextIdx]
    await this.prisma.ticketRoundRobinTracker.upsert({
      where: { scope_type_scope_id_role: { scope_type: scopeType, scope_id: scopeId, role } },
      update: { last_assigned_user_id: assignedUserId, assignment_count: { increment: 1 } },
      create: {
        organization_id: orgId,
        scope_type: scopeType,
        scope_id: scopeId,
        role,
        last_assigned_user_id: assignedUserId,
        assignment_count: 1,
      },
    })
    return assignedUserId
  }

  private async getAdminUserIds(orgId: string): Promise<string[]> {
    const members = await this.prisma.organizationMember.findMany({
      where: { organization_id: orgId, role: { in: ['org_admin', 'hr_manager'] as never[] }, is_active: true },
      select: { user_id: true },
    })
    return members.map((m) => m.user_id)
  }

  // ─── Masters ───────────────────────────────────────────────────────────────

  async getConfig(orgId: string) {
    await this.ensureDefaults(orgId)
    return this.prisma.ticketMaster.findUnique({ where: { organization_id: orgId } })
  }

  async updateConfig(orgId: string, dto: UpdateTicketMasterDto) {
    return this.prisma.ticketMaster.update({
      where: { organization_id: orgId },
      data: dto as never,
    })
  }

  async listTypes(orgId: string) {
    return this.prisma.ticketType.findMany({ where: { organization_id: orgId }, orderBy: { order_index: 'asc' } })
  }

  async createType(orgId: string, dto: CreateTicketTypeDto) {
    return this.prisma.ticketType.create({ data: { organization_id: orgId, ...dto } })
  }

  async updateType(orgId: string, typeId: string, dto: UpdateTicketTypeDto) {
    return this.prisma.ticketType.update({ where: { id: typeId }, data: dto })
  }

  async deleteType(orgId: string, typeId: string) {
    return this.prisma.ticketType.update({ where: { id: typeId }, data: { is_active: false } })
  }

  async listCategories(orgId: string, typeId?: string) {
    return this.prisma.ticketCategory.findMany({
      where: { organization_id: orgId, ...(typeId ? { ticket_type_id: typeId } : {}) },
      orderBy: { name: 'asc' },
    })
  }

  async createCategory(orgId: string, dto: CreateTicketCategoryDto) {
    return this.prisma.ticketCategory.create({ data: { organization_id: orgId, ...dto } })
  }

  async updateCategory(orgId: string, categoryId: string, dto: UpdateTicketCategoryDto) {
    return this.prisma.ticketCategory.update({ where: { id: categoryId }, data: dto as never })
  }

  async deleteCategory(orgId: string, categoryId: string) {
    return this.prisma.ticketCategory.update({ where: { id: categoryId }, data: { is_active: false } })
  }

  async listPriorities(orgId: string) {
    return this.prisma.ticketPriority.findMany({ where: { organization_id: orgId }, orderBy: { order_index: 'asc' } })
  }

  async createPriority(orgId: string, dto: CreateTicketPriorityDto) {
    return this.prisma.ticketPriority.create({ data: { organization_id: orgId, ...dto } })
  }

  async updatePriority(orgId: string, priorityId: string, dto: UpdateTicketPriorityDto) {
    return this.prisma.ticketPriority.update({ where: { id: priorityId }, data: dto })
  }

  async deletePriority(orgId: string, priorityId: string) {
    return this.prisma.ticketPriority.update({ where: { id: priorityId }, data: { is_active: false } })
  }

  async listStatuses(orgId: string) {
    return this.prisma.ticketStatus.findMany({ where: { organization_id: orgId }, orderBy: { order_index: 'asc' } })
  }

  async createStatus(orgId: string, dto: CreateTicketStatusDto) {
    return this.prisma.ticketStatus.create({ data: { organization_id: orgId, ...dto } })
  }

  async updateStatus(orgId: string, statusId: string, dto: UpdateTicketStatusDto) {
    return this.prisma.ticketStatus.update({ where: { id: statusId }, data: dto })
  }

  async reorderStatuses(orgId: string, dto: ReorderTicketStatusesDto) {
    await Promise.all(
      dto.items.map((item) =>
        this.prisma.ticketStatus.update({ where: { id: item.id }, data: { order_index: item.order_index } }),
      ),
    )
    return this.listStatuses(orgId)
  }

  async listTemplates(orgId: string) {
    return this.prisma.ticketTemplate.findMany({
      where: { organization_id: orgId, is_active: true },
      include: { ticket_type: true, category: true, priority: true },
      orderBy: { name: 'asc' },
    })
  }

  async createTemplate(orgId: string, userId: string, dto: CreateTicketTemplateDto) {
    return this.prisma.ticketTemplate.create({
      data: { organization_id: orgId, created_by_user_id: userId, ...dto },
    })
  }

  async updateTemplate(orgId: string, templateId: string, dto: UpdateTicketTemplateDto) {
    return this.prisma.ticketTemplate.update({ where: { id: templateId }, data: dto })
  }

  async archiveTemplate(orgId: string, templateId: string) {
    return this.prisma.ticketTemplate.update({ where: { id: templateId }, data: { is_active: false } })
  }

  // ─── Ticket Lifecycle ──────────────────────────────────────────────────────

  async raiseTicket(orgId: string, userId: string, dto: RaiseTicketDto) {
    await this.ensureDefaults(orgId)
    const master = await this.prisma.ticketMaster.findUnique({ where: { organization_id: orgId } })!

    const [ticketType, category, priority] = await Promise.all([
      this.prisma.ticketType.findUnique({ where: { id: dto.ticket_type_id } }),
      dto.category_id ? this.prisma.ticketCategory.findUnique({ where: { id: dto.category_id } }) : null,
      dto.priority_id ? this.prisma.ticketPriority.findUnique({ where: { id: dto.priority_id } }) : null,
    ])
    if (!ticketType) throw new NotFoundException('Ticket type not found')

    const sla_days = this.resolveSlaFromConfigs(
      ticketType.default_sla_days,
      category?.default_sla_days,
      priority?.sla_days,
    )
    const now = new Date()
    const sla_due_at = new Date(now.getTime() + sla_days * 24 * 60 * 60 * 1000)

    const assigneeId = dto.assigned_to_user_id ?? await this.resolveAutoAssignee(orgId, dto.ticket_type_id, dto.category_id, dto.template_id)
    const openStatus = await this.getStatusByType(orgId, assigneeId ? 'assigned' : 'open')

    const ticket_number = await this.generateTicketNumber(orgId)

    const ticket = await this.prisma.ticket.create({
      data: {
        organization_id: orgId,
        ticket_number,
        title: dto.title,
        description: dto.description,
        ticket_type_id: dto.ticket_type_id,
        category_id: dto.category_id,
        priority_id: dto.priority_id,
        status_id: openStatus.id,
        template_id: dto.template_id,
        raised_by_user_id: userId,
        assigned_to_user_id: assigneeId,
        assigned_at: assigneeId ? now : undefined,
        sla_days,
        sla_due_at,
        requires_raiser_confirmation: master?.require_raiser_confirmation ?? false,
        proof_required: dto.proof_required ?? false,
        checklist: dto.checklist_items?.length
          ? {
              create: dto.checklist_items.map((item, i) => ({
                organization_id: orgId,
                title: item.title,
                order_index: i,
              })),
            }
          : undefined,
        escalations: dto.escalation_user_ids?.length
          ? {
              create: dto.escalation_user_ids.map((uid, i) => ({
                organization_id: orgId,
                level: i + 1,
                escalate_to_user_id: uid,
              })),
            }
          : undefined,
      },
      include: TICKET_INCLUDE,
    })

    await this.logActivity(orgId, ticket.id, userId, 'created')

    if (assigneeId) {
      await this.notifyUser(orgId, ticket.id, assigneeId, 'assigned', `You have been assigned ticket ${ticket_number}: ${dto.title}`)
    } else {
      const adminIds = await this.getAdminUserIds(orgId)
      await this.notifyUsers(orgId, ticket.id, adminIds, 'unassigned', `Ticket ${ticket_number} has no assignee and needs manual assignment`)
    }

    return ticket
  }

  async listTickets(
    orgId: string,
    filters: {
      typeId?: string
      categoryId?: string
      priorityId?: string
      statusId?: string
      assignedTo?: string
      raisedBy?: string
      slaBreached?: boolean
      from?: string
      to?: string
      search?: string
    },
  ) {
    const where: Record<string, unknown> = {
      organization_id: orgId,
      is_deleted: false,
      ...(filters.typeId && { ticket_type_id: filters.typeId }),
      ...(filters.categoryId && { category_id: filters.categoryId }),
      ...(filters.priorityId && { priority_id: filters.priorityId }),
      ...(filters.statusId && { status_id: filters.statusId }),
      ...(filters.assignedTo && { assigned_to_user_id: filters.assignedTo }),
      ...(filters.raisedBy && { raised_by_user_id: filters.raisedBy }),
      ...(filters.slaBreached !== undefined && { sla_breached: filters.slaBreached }),
      ...(filters.search && {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { ticket_number: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      ...(filters.from || filters.to
        ? {
            created_at: {
              ...(filters.from && { gte: new Date(filters.from) }),
              ...(filters.to && { lte: new Date(filters.to) }),
            },
          }
        : {}),
    }
    return this.prisma.ticket.findMany({
      where,
      include: TICKET_INCLUDE,
      orderBy: { created_at: 'desc' },
    })
  }

  async getTicket(orgId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organization_id: orgId, is_deleted: false },
      include: { ...TICKET_INCLUDE, activity_logs: { orderBy: { created_at: 'asc' } } },
    })
    if (!ticket) throw new NotFoundException('Ticket not found')
    return ticket
  }

  async updateTicket(orgId: string, userId: string, ticketId: string, dto: UpdateTicketDto) {
    await this.getTicket(orgId, ticketId)
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: dto,
      include: TICKET_INCLUDE,
    })
    await this.logActivity(orgId, ticketId, userId, 'status_changed', { action: 'edited' })
    return updated
  }

  async assignTicket(orgId: string, userId: string, userRole: string, ticketId: string, dto: AssignTicketDto) {
    const ticket = await this.getTicket(orgId, ticketId)
    const master = await this.prisma.ticketMaster.findUnique({ where: { organization_id: orgId } })
    const mode = master?.reassignment_mode ?? 'both'

    const isAdmin = ['org_admin', 'hr_manager'].includes(userRole)
    const isAssignee = ticket.assigned_to_user_id === userId
    if (mode === 'assignee_only' && !isAssignee) throw new ForbiddenException('Only the assignee can reassign this ticket')
    if (mode === 'admin_manager_only' && !isAdmin) throw new ForbiddenException('Only admins can reassign this ticket')

    const wasAssigned = !!ticket.assigned_to_user_id
    const assignedStatus = await this.getStatusByType(orgId, 'assigned')
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assigned_to_user_id: dto.assigned_to_user_id,
        assigned_at: new Date(),
        status_id: assignedStatus.id,
      },
      include: TICKET_INCLUDE,
    })
    await this.logActivity(orgId, ticketId, userId, wasAssigned ? 'reassigned' : 'assigned', {
      assigned_to: dto.assigned_to_user_id,
    })
    await this.notifyUser(orgId, ticketId, dto.assigned_to_user_id, wasAssigned ? 'reassigned' : 'assigned',
      `You have been ${wasAssigned ? 'reassigned' : 'assigned'} ticket ${ticket.ticket_number}: ${ticket.title}`)
    return updated
  }

  async acceptTicket(orgId: string, userId: string, ticketId: string) {
    const ticket = await this.getTicket(orgId, ticketId)
    if (ticket.assigned_to_user_id !== userId) throw new ForbiddenException('Only the assigned user can accept this ticket')
    if (ticket.status.type !== 'assigned') throw new BadRequestException('Ticket must be in Assigned status to accept')
    const inProgressStatus = await this.getStatusByType(orgId, 'in_progress')
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { accepted_at: new Date(), status_id: inProgressStatus.id },
      include: TICKET_INCLUDE,
    })
    await this.logActivity(orgId, ticketId, userId, 'accepted')
    await this.notifyUser(orgId, ticketId, ticket.raised_by_user_id, 'status_changed',
      `Your ticket ${ticket.ticket_number} has been accepted and is now in progress`)
    return updated
  }

  async resolveTicket(orgId: string, userId: string, ticketId: string, dto: ResolveTicketDto) {
    if (!dto.resolution_note?.trim()) throw new BadRequestException('Resolution note is required')
    const ticket = await this.getTicket(orgId, ticketId)
    if (ticket.assigned_to_user_id !== userId) throw new ForbiddenException('Only the assigned user can resolve this ticket')
    if (!['in_progress', 'assigned'].includes(ticket.status.type)) throw new BadRequestException('Ticket must be in progress to resolve')

    const resolvedStatus = await this.getStatusByType(orgId, 'resolved')
    let statusId = resolvedStatus.id
    let closedAt: Date | undefined = undefined

    if (!ticket.requires_raiser_confirmation) {
      const closedStatus = await this.getStatusByType(orgId, 'closed_resolved')
      statusId = closedStatus.id
      closedAt = new Date()
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        resolved_at: new Date(),
        resolution_note: dto.resolution_note,
        status_id: statusId,
        ...(closedAt && { closed_at: closedAt }),
      },
      include: TICKET_INCLUDE,
    })

    await this.logActivity(orgId, ticketId, userId, 'resolved', { resolution_note: dto.resolution_note })
    if (ticket.requires_raiser_confirmation) {
      await this.logActivity(orgId, ticketId, userId, 'confirmation_requested')
      await this.notifyUser(orgId, ticketId, ticket.raised_by_user_id, 'confirmation_requested',
        `Your ticket ${ticket.ticket_number} has been marked as resolved. Please confirm if your issue is resolved.`)
    } else {
      await this.logActivity(orgId, ticketId, userId, 'closed', { status_type: 'closed_resolved' })
      await this.notifyUser(orgId, ticketId, ticket.raised_by_user_id, 'status_changed',
        `Your ticket ${ticket.ticket_number} has been resolved and closed`)
    }
    return updated
  }

  async closeTicket(orgId: string, userId: string, ticketId: string, dto: CloseTicketDto) {
    const ticket = await this.getTicket(orgId, ticketId)
    const closedStatus = await this.getStatusByType(orgId, dto.status_type)
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { closed_at: new Date(), status_id: closedStatus.id },
      include: TICKET_INCLUDE,
    })
    await this.logActivity(orgId, ticketId, userId, 'closed', { status_type: dto.status_type })
    await this.notifyUser(orgId, ticketId, ticket.raised_by_user_id, 'status_changed',
      `Your ticket ${ticket.ticket_number} has been closed`)
    return updated
  }

  async confirmResolution(orgId: string, userId: string, ticketId: string) {
    const ticket = await this.getTicket(orgId, ticketId)
    if (ticket.raised_by_user_id !== userId) throw new ForbiddenException('Only the ticket raiser can confirm resolution')
    if (ticket.status.type !== 'resolved') throw new BadRequestException('Ticket must be resolved before confirmation')
    const closedStatus = await this.getStatusByType(orgId, 'closed_resolved')
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { raiser_confirmed_at: new Date(), closed_at: new Date(), status_id: closedStatus.id },
      include: TICKET_INCLUDE,
    })
    await this.logActivity(orgId, ticketId, userId, 'raiser_confirmed')
    return updated
  }

  async submitRating(orgId: string, userId: string, ticketId: string, dto: RateTicketDto) {
    const ticket = await this.getTicket(orgId, ticketId)
    if (ticket.raised_by_user_id !== userId) throw new ForbiddenException('Only the ticket raiser can rate')
    if (!ticket.closed_at) throw new BadRequestException('Ticket must be closed before rating')
    if (ticket.rated_at) throw new BadRequestException('Ticket has already been rated')
    if (dto.rating < 1 || dto.rating > 5) throw new BadRequestException('Rating must be between 1 and 5')
    const master = await this.prisma.ticketMaster.findUnique({ where: { organization_id: orgId } })
    if (!master?.enable_rating) throw new BadRequestException('Rating is not enabled for this organization')
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { rating: dto.rating, rating_comment: dto.comment, rated_at: new Date() },
      include: TICKET_INCLUDE,
    })
    await this.logActivity(orgId, ticketId, userId, 'rating_submitted', { rating: dto.rating })
    return updated
  }

  async submitProof(orgId: string, userId: string, ticketId: string, proofUrl: string) {
    await this.getTicket(orgId, ticketId)
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { proof_url: proofUrl },
      include: TICKET_INCLUDE,
    })
    await this.logActivity(orgId, ticketId, userId, 'proof_attached', { proof_url: proofUrl })
    return updated
  }

  async softDeleteTicket(orgId: string, userId: string, ticketId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Deletion reason is required')
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organization_id: orgId, is_deleted: false },
      include: { ...TICKET_INCLUDE, checklist: true, escalations: true, activity_logs: true, comments: true },
    })
    if (!ticket) throw new NotFoundException('Ticket not found')
    await this.prisma.ticketArchive.create({
      data: {
        organization_id: orgId,
        original_ticket_id: ticketId,
        raised_by_user_id: ticket.raised_by_user_id,
        ticket_snapshot: ticket as never,
        deleted_by_user_id: userId,
        deletion_reason: reason,
        deleted_at: new Date(),
      },
    })
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { is_deleted: true, deleted_by_user_id: userId, deleted_at: new Date(), deletion_reason: reason },
    })
    await this.logActivity(orgId, ticketId, userId, 'deleted', { reason })
  }

  async listArchive(orgId: string, raisedByUserId?: string) {
    return this.prisma.ticketArchive.findMany({
      where: {
        organization_id: orgId,
        ...(raisedByUserId && { raised_by_user_id: raisedByUserId }),
      },
      orderBy: { deleted_at: 'desc' },
    })
  }

  // ─── Comments ──────────────────────────────────────────────────────────────

  async getComments(orgId: string, ticketId: string) {
    return this.prisma.ticketComment.findMany({
      where: { ticket_id: ticketId, organization_id: orgId, reply_to_comment_id: null, is_deleted: false },
      include: { replies: { where: { is_deleted: false }, orderBy: { created_at: 'asc' } } },
      orderBy: { created_at: 'asc' },
    })
  }

  async addComment(orgId: string, userId: string, ticketId: string, dto: AddTicketCommentDto) {
    await this.getTicket(orgId, ticketId)
    const comment = await this.prisma.ticketComment.create({
      data: {
        organization_id: orgId,
        ticket_id: ticketId,
        user_id: userId,
        body: dto.body,
        attachment_urls: dto.attachment_urls ?? [],
        reply_to_comment_id: dto.reply_to_comment_id,
      },
    })
    await this.logActivity(orgId, ticketId, userId, 'comment_added')
    return comment
  }

  async deleteComment(orgId: string, userId: string, commentId: string) {
    const comment = await this.prisma.ticketComment.findUnique({ where: { id: commentId } })
    if (!comment) throw new NotFoundException('Comment not found')
    if (comment.user_id !== userId) throw new ForbiddenException('You can only delete your own comments')
    await this.prisma.ticketComment.update({
      where: { id: commentId },
      data: { is_deleted: true, deleted_at: new Date() },
    })
    await this.logActivity(orgId, comment.ticket_id, userId, 'comment_deleted')
  }

  async toggleChecklist(orgId: string, userId: string, ticketId: string, itemId: string) {
    const item = await this.prisma.ticketChecklist.findUnique({ where: { id: itemId } })
    if (!item) throw new NotFoundException('Checklist item not found')
    const updated = await this.prisma.ticketChecklist.update({
      where: { id: itemId },
      data: { is_completed: !item.is_completed },
    })
    await this.logActivity(orgId, ticketId, userId, 'checklist_updated', { item_id: itemId, completed: updated.is_completed })
    return updated
  }

  async getActivityLog(orgId: string, ticketId: string) {
    return this.prisma.ticketActivityLog.findMany({
      where: { ticket_id: ticketId, organization_id: orgId },
      orderBy: { created_at: 'asc' },
    })
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  async getStats(orgId: string, userId: string) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [open, assignedToMe, slaBreached, resolvedThisMonth] = await Promise.all([
      this.prisma.ticket.count({ where: { organization_id: orgId, is_deleted: false, status: { type: 'open' } } }),
      this.prisma.ticket.count({ where: { organization_id: orgId, is_deleted: false, assigned_to_user_id: userId } }),
      this.prisma.ticket.count({ where: { organization_id: orgId, is_deleted: false, sla_breached: true, status: { type: { notIn: ['closed_resolved', 'closed_unresolved'] } } } }),
      this.prisma.ticket.count({ where: { organization_id: orgId, is_deleted: false, resolved_at: { gte: monthStart } } }),
    ])
    return { open, assignedToMe, slaBreached, resolvedThisMonth }
  }

  // ─── Reports ───────────────────────────────────────────────────────────────

  async getResolutionTimeReport(orgId: string, from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to)
    const tickets = await this.prisma.ticket.findMany({
      where: { organization_id: orgId, is_deleted: false, resolved_at: { not: null }, ...dateFilter },
      select: { assigned_to_user_id: true, created_at: true, resolved_at: true },
    })
    const byUser: Record<string, { total: number; sum: number }> = {}
    for (const t of tickets) {
      if (!t.assigned_to_user_id || !t.resolved_at) continue
      const days = (t.resolved_at.getTime() - t.created_at.getTime()) / (1000 * 60 * 60 * 24)
      if (!byUser[t.assigned_to_user_id]) byUser[t.assigned_to_user_id] = { total: 0, sum: 0 }
      byUser[t.assigned_to_user_id].total++
      byUser[t.assigned_to_user_id].sum += days
    }
    return Object.entries(byUser).map(([userId, { total, sum }]) => ({
      user_id: userId,
      ticket_count: total,
      avg_days: Math.round((sum / total) * 10) / 10,
    }))
  }

  async getBreakdownReport(orgId: string, groupBy: 'type' | 'category' | 'priority' | 'status', from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to)
    const tickets = await this.prisma.ticket.findMany({
      where: { organization_id: orgId, is_deleted: false, ...dateFilter },
      include: { ticket_type: true, category: true, priority: true, status: true },
    })
    const groups: Record<string, { label: string; color: string; count: number }> = {}
    for (const t of tickets) {
      let key = '', label = '', color = ''
      if (groupBy === 'type') { key = t.ticket_type_id; label = t.ticket_type.name; color = t.ticket_type.color }
      else if (groupBy === 'category') { key = t.category_id ?? 'none'; label = t.category?.name ?? 'None'; color = t.category?.color ?? '#94A3B8' }
      else if (groupBy === 'priority') { key = t.priority_id ?? 'none'; label = t.priority?.label ?? 'None'; color = t.priority?.color ?? '#94A3B8' }
      else { key = t.status_id; label = t.status.label; color = t.status.color }
      if (!groups[key]) groups[key] = { label, color, count: 0 }
      groups[key].count++
    }
    const total = tickets.length
    return Object.values(groups).map((g) => ({ ...g, share: total > 0 ? Math.round((g.count / total) * 100) : 0 }))
  }

  async getSlaBreachReport(orgId: string, from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to)
    const total = await this.prisma.ticket.count({ where: { organization_id: orgId, is_deleted: false, ...dateFilter } })
    const breached = await this.prisma.ticket.count({ where: { organization_id: orgId, is_deleted: false, sla_breached: true, ...dateFilter } })
    const tickets = await this.prisma.ticket.findMany({
      where: { organization_id: orgId, is_deleted: false, sla_breached: true, ...dateFilter },
      include: { ticket_type: true, priority: true, status: true },
      orderBy: { sla_due_at: 'asc' },
    })
    return { total, breached, breach_rate: total > 0 ? Math.round((breached / total) * 100) : 0, tickets }
  }

  async getRatingsReport(orgId: string, from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to)
    const tickets = await this.prisma.ticket.findMany({
      where: { organization_id: orgId, is_deleted: false, rated_at: { not: null }, ...dateFilter },
      select: { rating: true, rating_comment: true, rated_at: true, ticket_number: true, title: true },
    })
    const total = tickets.length
    const avg = total > 0 ? tickets.reduce((sum, t) => sum + (t.rating ?? 0), 0) / total : 0
    const distribution = [1, 2, 3, 4, 5].map((r) => ({
      rating: r,
      count: tickets.filter((t) => t.rating === r).length,
    }))
    return { total_ratings: total, avg_rating: Math.round(avg * 10) / 10, distribution, tickets }
  }

  private buildDateFilter(from?: string, to?: string) {
    if (!from && !to) return {}
    return { created_at: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }
  }

  // ─── Cron ──────────────────────────────────────────────────────────────────

  @Cron('0 * * * *')
  async processSlaBreaches() {
    const now = new Date()
    const tickets = await this.prisma.ticket.findMany({
      where: {
        sla_due_at: { lt: now },
        sla_breached: false,
        is_deleted: false,
        status: { type: { notIn: ['closed_resolved', 'closed_unresolved'] } },
      },
      include: { escalations: { orderBy: { level: 'asc' } } },
    })

    for (const ticket of tickets) {
      await this.prisma.ticket.update({ where: { id: ticket.id }, data: { sla_breached: true } })
      await this.logActivity(ticket.organization_id, ticket.id, 'system', 'sla_breached')

      if (ticket.assigned_to_user_id) {
        await this.notifyUser(ticket.organization_id, ticket.id, ticket.assigned_to_user_id, 'sla_breached',
          `SLA breached on ticket ${ticket.ticket_number}: ${ticket.title}`)
      }

      const level1 = ticket.escalations.find((e) => e.level === 1 && e.is_active && !e.escalated_at)
      if (level1) {
        await this.prisma.ticketEscalation.update({
          where: { id: level1.id },
          data: { escalated_at: now },
        })
        await this.notifyUser(ticket.organization_id, ticket.id, level1.escalate_to_user_id, 'escalated',
          `Ticket ${ticket.ticket_number} SLA has been breached and escalated to you: ${ticket.title}`)
        await this.logActivity(ticket.organization_id, ticket.id, 'system', 'escalated', { level: 1, user_id: level1.escalate_to_user_id })
      }
    }
  }

  // ─── Notifications ─────────────────────────────────────────────────────────

  async getNotifications(orgId: string, userId: string) {
    return this.prisma.ticketNotification.findMany({
      where: { organization_id: orgId, user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 50,
    })
  }

  async markNotificationRead(orgId: string, userId: string, notificationId: string) {
    return this.prisma.ticketNotification.update({
      where: { id: notificationId },
      data: { is_read: true },
    })
  }
}
