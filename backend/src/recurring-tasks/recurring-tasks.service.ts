import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';

@Injectable()
export class RecurringTasksService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async findTemplateOrFail(orgId: string, templateId: string) {
    const t = await this.prisma.recurringTemplate.findFirst({
      where: { id: templateId, organization_id: orgId },
    });
    if (!t) throw new NotFoundException(`Recurring template ${templateId} not found`);
    return t;
  }

  // ─── List ─────────────────────────────────────────────────────────────────────

  async listTemplates(orgId: string) {
    return this.prisma.recurringTemplate.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async createTemplate(orgId: string, userId: string, dto: CreateRecurringDto) {
    return this.prisma.recurringTemplate.create({
      data: {
        organization_id: orgId,
        created_by_user_id: userId,
        title: dto.title,
        description: dto.description,
        quadrant: dto.quadrant ?? 'Q2',
        category_id: dto.category_id,
        priority_id: dto.priority_id,
        schedule_type: dto.schedule_type,
        every: dto.every ?? 1,
        days: dto.days ?? [],
        month_day: dto.month_day,
        month: dto.month,
        time: dto.time ?? '09:00',
        start_date: new Date(dto.start_date),
        end_condition: dto.end_condition ?? 'never',
        end_date: dto.end_date ? new Date(dto.end_date) : undefined,
        end_after: dto.end_after,
        completion_mode: dto.completion_mode ?? 'any_can_complete',
        proof_required: dto.proof_required ?? false,
        assignee_user_ids: dto.assignee_user_ids ?? [],
        cc_user_ids: dto.cc_user_ids ?? [],
        department_id: dto.department_id,
      },
    });
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async updateTemplate(orgId: string, templateId: string, dto: UpdateRecurringDto) {
    await this.findTemplateOrFail(orgId, templateId);
    return this.prisma.recurringTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.quadrant !== undefined && { quadrant: dto.quadrant }),
        ...(dto.category_id !== undefined && { category_id: dto.category_id }),
        ...(dto.priority_id !== undefined && { priority_id: dto.priority_id }),
        ...(dto.schedule_type !== undefined && { schedule_type: dto.schedule_type }),
        ...(dto.every !== undefined && { every: dto.every }),
        ...(dto.days !== undefined && { days: dto.days }),
        ...(dto.month_day !== undefined && { month_day: dto.month_day }),
        ...(dto.month !== undefined && { month: dto.month }),
        ...(dto.time !== undefined && { time: dto.time }),
        ...(dto.start_date !== undefined && { start_date: new Date(dto.start_date) }),
        ...(dto.end_condition !== undefined && { end_condition: dto.end_condition }),
        ...(dto.end_date !== undefined && { end_date: new Date(dto.end_date) }),
        ...(dto.end_after !== undefined && { end_after: dto.end_after }),
        ...(dto.completion_mode !== undefined && { completion_mode: dto.completion_mode }),
        ...(dto.proof_required !== undefined && { proof_required: dto.proof_required }),
        ...(dto.assignee_user_ids !== undefined && { assignee_user_ids: dto.assignee_user_ids }),
        ...(dto.cc_user_ids !== undefined && { cc_user_ids: dto.cc_user_ids }),
        ...(dto.department_id !== undefined && { department_id: dto.department_id }),
      },
    });
  }

  // ─── Pause / Resume ──────────────────────────────────────────────────────────

  async pauseTemplate(orgId: string, templateId: string) {
    await this.findTemplateOrFail(orgId, templateId);
    return this.prisma.recurringTemplate.update({
      where: { id: templateId },
      data: { is_active: false },
    });
  }

  async resumeTemplate(orgId: string, templateId: string) {
    await this.findTemplateOrFail(orgId, templateId);
    return this.prisma.recurringTemplate.update({
      where: { id: templateId },
      data: { is_active: true },
    });
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  /**
   * mode:
   *   stop         → deactivate only (keep instances)
   *   delete-future → delete instances not yet completed + deactivate
   *   delete-all   → delete all instances + delete template
   */
  async deleteTemplate(orgId: string, templateId: string, mode: 'stop' | 'delete-future' | 'delete-all' = 'stop') {
    await this.findTemplateOrFail(orgId, templateId);

    if (mode === 'delete-all') {
      // Soft-delete all task instances
      await this.prisma.task.updateMany({
        where: { organization_id: orgId, recurring_template_id: templateId, is_deleted: false },
        data: { is_deleted: true, deleted_at: new Date(), deletion_reason: 'Recurring template deleted' },
      });
      await this.prisma.recurringTemplate.delete({ where: { id: templateId } });
      return { message: 'Template and all instances deleted' };
    }

    if (mode === 'delete-future') {
      // Find the completed status type to know which tasks are not completed
      const completedStatuses = await this.prisma.taskStatus.findMany({
        where: { organization_id: orgId, type: 'completed' },
        select: { id: true },
      });
      const completedStatusIds = completedStatuses.map((s) => s.id);

      await this.prisma.task.updateMany({
        where: {
          organization_id: orgId,
          recurring_template_id: templateId,
          is_deleted: false,
          status_id: { notIn: completedStatusIds },
        },
        data: { is_deleted: true, deleted_at: new Date(), deletion_reason: 'Recurring template stopped' },
      });
    }

    // Always deactivate in stop and delete-future modes
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
      include: {
        status: true,
        priority: true,
        category: true,
        assignees: true,
      },
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
      this.prisma.task.count({
        where: { organization_id: orgId, recurring_template_id: templateId, is_deleted: false },
      }),
      this.prisma.task.count({
        where: {
          organization_id: orgId,
          recurring_template_id: templateId,
          is_deleted: false,
          status_id: { in: completedStatusIds },
        },
      }),
    ]);

    const pending = total - completed;
    const completionRatio = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      template_id: templateId,
      total_instances: total,
      completed,
      pending,
      completion_ratio_percent: completionRatio,
    };
  }
}
