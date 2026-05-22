import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';
import { CreateScheduleEntryDto } from './dto/create-schedule-entry.dto';

const ENTRY_INCLUDE = { orderBy: { order_index: 'asc' as const } };

@Injectable()
export class RecurringTasksService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async findTemplateOrFail(orgId: string, templateId: string) {
    const t = await this.prisma.recurringTemplate.findFirst({
      where: { id: templateId, organization_id: orgId },
      include: { schedule_entries: ENTRY_INCLUDE },
    });
    if (!t) throw new NotFoundException(`Recurring template ${templateId} not found`);
    return t;
  }

  private entryData(orgId: string, templateId: string, dto: CreateScheduleEntryDto, index = 0) {
    return {
      organization_id: orgId,
      recurring_template_id: templateId,
      schedule_type: dto.schedule_type,
      every: dto.every ?? 1,
      days: dto.days ?? [],
      month_days: dto.month_days ?? [],
      yearly_dates: (dto.yearly_dates ?? []) as never,
      time: dto.time,
      start_date: new Date(dto.start_date),
      end_condition: dto.end_condition ?? 'never',
      end_date: dto.end_date ? new Date(dto.end_date) : undefined,
      end_after: dto.end_after ?? undefined,
      order_index: dto.order_index ?? index,
    };
  }

  // ─── List ─────────────────────────────────────────────────────────────────────

  async listTemplates(orgId: string) {
    return this.prisma.recurringTemplate.findMany({
      where: { organization_id: orgId },
      include: { schedule_entries: ENTRY_INCLUDE },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async createTemplate(orgId: string, userId: string, dto: CreateRecurringDto) {
    const template = await this.prisma.recurringTemplate.create({
      data: {
        organization_id: orgId,
        created_by_user_id: userId,
        title: dto.title,
        description: dto.description,
        quadrant: dto.quadrant ?? 'Q2',
        category_id: dto.category_id,
        priority_id: dto.priority_id,
        has_multiple_schedules: dto.schedule_entries.length > 1,
        completion_mode: dto.completion_mode ?? 'any_can_complete',
        proof_required: dto.proof_required ?? false,
        assignee_user_ids: dto.assignee_user_ids ?? [],
        cc_user_ids: dto.cc_user_ids ?? [],
        department_id: dto.department_id,
      },
    });

    await this.prisma.recurringScheduleEntry.createMany({
      data: dto.schedule_entries.map((e, i) => this.entryData(orgId, template.id, e, i)),
    });

    return this.prisma.recurringTemplate.findUnique({
      where: { id: template.id },
      include: { schedule_entries: ENTRY_INCLUDE },
    });
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async updateTemplate(orgId: string, templateId: string, dto: UpdateRecurringDto) {
    await this.findTemplateOrFail(orgId, templateId);

    if (dto.schedule_entries !== undefined) {
      if (dto.schedule_entries.length === 0) {
        throw new BadRequestException('Template must have at least one schedule entry');
      }
      await this.prisma.recurringScheduleEntry.deleteMany({
        where: { recurring_template_id: templateId },
      });
      await this.prisma.recurringScheduleEntry.createMany({
        data: dto.schedule_entries.map((e, i) => this.entryData(orgId, templateId, e, i)),
      });
    }

    const entryCount = await this.prisma.recurringScheduleEntry.count({
      where: { recurring_template_id: templateId },
    });

    return this.prisma.recurringTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.quadrant !== undefined && { quadrant: dto.quadrant }),
        ...(dto.category_id !== undefined && { category_id: dto.category_id }),
        ...(dto.priority_id !== undefined && { priority_id: dto.priority_id }),
        ...(dto.completion_mode !== undefined && { completion_mode: dto.completion_mode }),
        ...(dto.proof_required !== undefined && { proof_required: dto.proof_required }),
        ...(dto.assignee_user_ids !== undefined && { assignee_user_ids: dto.assignee_user_ids }),
        ...(dto.cc_user_ids !== undefined && { cc_user_ids: dto.cc_user_ids }),
        ...(dto.department_id !== undefined && { department_id: dto.department_id }),
        has_multiple_schedules: entryCount > 1,
      },
      include: { schedule_entries: ENTRY_INCLUDE },
    });
  }

  // ─── Schedule Entries ─────────────────────────────────────────────────────────

  async listScheduleEntries(orgId: string, templateId: string) {
    await this.findTemplateOrFail(orgId, templateId);
    return this.prisma.recurringScheduleEntry.findMany({
      where: { recurring_template_id: templateId },
      orderBy: { order_index: 'asc' },
    });
  }

  async addScheduleEntry(orgId: string, templateId: string, dto: CreateScheduleEntryDto) {
    await this.findTemplateOrFail(orgId, templateId);
    const count = await this.prisma.recurringScheduleEntry.count({
      where: { recurring_template_id: templateId },
    });
    const entry = await this.prisma.recurringScheduleEntry.create({
      data: this.entryData(orgId, templateId, dto, count),
    });
    await this.prisma.recurringTemplate.update({
      where: { id: templateId },
      data: { has_multiple_schedules: count + 1 > 1 },
    });
    return entry;
  }

  async updateScheduleEntry(
    orgId: string,
    templateId: string,
    entryId: string,
    dto: Partial<CreateScheduleEntryDto>,
  ) {
    await this.findTemplateOrFail(orgId, templateId);
    const entry = await this.prisma.recurringScheduleEntry.findFirst({
      where: { id: entryId, recurring_template_id: templateId },
    });
    if (!entry) throw new NotFoundException(`Schedule entry ${entryId} not found`);

    return this.prisma.recurringScheduleEntry.update({
      where: { id: entryId },
      data: {
        ...(dto.schedule_type !== undefined && { schedule_type: dto.schedule_type }),
        ...(dto.every !== undefined && { every: dto.every }),
        ...(dto.days !== undefined && { days: dto.days }),
        ...(dto.month_days !== undefined && { month_days: dto.month_days }),
        ...(dto.yearly_dates !== undefined && { yearly_dates: dto.yearly_dates as never }),
        ...(dto.time !== undefined && { time: dto.time }),
        ...(dto.start_date !== undefined && { start_date: new Date(dto.start_date) }),
        ...(dto.end_condition !== undefined && { end_condition: dto.end_condition }),
        ...(dto.end_date !== undefined && { end_date: new Date(dto.end_date) }),
        ...(dto.end_after !== undefined && { end_after: dto.end_after }),
        ...(dto.order_index !== undefined && { order_index: dto.order_index }),
      },
    });
  }

  async deleteScheduleEntry(orgId: string, templateId: string, entryId: string) {
    await this.findTemplateOrFail(orgId, templateId);
    const count = await this.prisma.recurringScheduleEntry.count({
      where: { recurring_template_id: templateId },
    });
    if (count <= 1) {
      throw new BadRequestException('Cannot delete the last schedule entry. A template must have at least one.');
    }
    await this.prisma.recurringScheduleEntry.delete({ where: { id: entryId } });
    await this.prisma.recurringTemplate.update({
      where: { id: templateId },
      data: { has_multiple_schedules: count - 1 > 1 },
    });
    return { message: 'Schedule entry deleted' };
  }

  // ─── Pause / Resume ──────────────────────────────────────────────────────────

  async pauseTemplate(orgId: string, templateId: string) {
    await this.findTemplateOrFail(orgId, templateId);
    return this.prisma.recurringTemplate.update({
      where: { id: templateId },
      data: { is_active: false },
      include: { schedule_entries: ENTRY_INCLUDE },
    });
  }

  async resumeTemplate(orgId: string, templateId: string) {
    await this.findTemplateOrFail(orgId, templateId);
    return this.prisma.recurringTemplate.update({
      where: { id: templateId },
      data: { is_active: true },
      include: { schedule_entries: ENTRY_INCLUDE },
    });
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  async deleteTemplate(orgId: string, templateId: string, mode: 'stop' | 'delete-future' | 'delete-all' = 'stop') {
    await this.findTemplateOrFail(orgId, templateId);

    if (mode === 'delete-all') {
      await this.prisma.task.updateMany({
        where: { organization_id: orgId, recurring_template_id: templateId, is_deleted: false },
        data: { is_deleted: true, deleted_at: new Date(), deletion_reason: 'Recurring template deleted' },
      });
      await this.prisma.recurringTemplate.delete({ where: { id: templateId } });
      return { message: 'Template and all instances deleted' };
    }

    if (mode === 'delete-future') {
      const completedStatuses = await this.prisma.taskStatus.findMany({
        where: { organization_id: orgId, type: 'completed' },
        select: { id: true },
      });
      await this.prisma.task.updateMany({
        where: {
          organization_id: orgId,
          recurring_template_id: templateId,
          is_deleted: false,
          status_id: { notIn: completedStatuses.map((s) => s.id) },
        },
        data: { is_deleted: true, deleted_at: new Date(), deletion_reason: 'Recurring template stopped' },
      });
    }

    await this.prisma.recurringTemplate.update({
      where: { id: templateId },
      data: { is_active: false },
    });

    return { message: `Template ${mode === 'delete-future' ? 'stopped and future instances removed' : 'stopped'}` };
  }

  // ─── Instances ───────────────────────────────────────────────────────────────

  async getInstances(orgId: string, templateId: string) {
    await this.findTemplateOrFail(orgId, templateId);
    return this.prisma.task.findMany({
      where: { organization_id: orgId, recurring_template_id: templateId, is_deleted: false },
      include: { status: true, priority: true, category: true, assignees: true },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── Stats ───────────────────────────────────────────────────────────────────

  async getStats(orgId: string, templateId: string) {
    await this.findTemplateOrFail(orgId, templateId);
    const completedStatuses = await this.prisma.taskStatus.findMany({
      where: { organization_id: orgId, type: 'completed' },
      select: { id: true },
    });
    const completedStatusIds = completedStatuses.map((s) => s.id);
    const [total, completed] = await Promise.all([
      this.prisma.task.count({ where: { organization_id: orgId, recurring_template_id: templateId, is_deleted: false } }),
      this.prisma.task.count({ where: { organization_id: orgId, recurring_template_id: templateId, is_deleted: false, status_id: { in: completedStatusIds } } }),
    ]);
    return {
      template_id: templateId,
      total_instances: total,
      completed,
      pending: total - completed,
      completion_ratio_percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}
