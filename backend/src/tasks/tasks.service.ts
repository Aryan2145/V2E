import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompletionMode,
  TaskActionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AddAssigneeDto } from './dto/add-assignee.dto';

const TASK_INCLUDE = {
  status: true,
  priority: true,
  category: true,
  assignees: true,
  checklist: { orderBy: { order_index: 'asc' as const } },
  escalations: true,
  reminders: true,
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async getOrgConfig(orgId: string) {
    return this.prisma.taskMaster.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId },
      update: {},
    });
  }

  private async findTaskOrFail(orgId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organization_id: orgId, is_deleted: false },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    return task;
  }

  private async logActivity(
    orgId: string,
    taskId: string,
    userId: string,
    action: TaskActionType,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.taskActivityLog.create({
      data: {
        organization_id: orgId,
        task_id: taskId,
        performed_by_user_id: userId,
        action,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });
  }

  private async enrichAssignees(assignees: { user_id: string; is_cc: boolean; is_completed: boolean; completed_at: Date | null; id: string }[]) {
    const userIds = assignees.map((a) => a.user_id);
    if (userIds.length === 0) return assignees.map((a) => ({ ...a, user: null }));
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return assignees.map((a) => ({ ...a, user: userMap.get(a.user_id) ?? null }));
  }

  private async getDefaultStatusId(orgId: string): Promise<string> {
    const status = await this.prisma.taskStatus.findFirst({
      where: { organization_id: orgId, is_default: true, is_active: true },
      orderBy: { order_index: 'asc' },
    });
    if (status) return status.id;
    const fallback = await this.prisma.taskStatus.findFirst({
      where: { organization_id: orgId, is_active: true },
      orderBy: { order_index: 'asc' },
    });
    if (!fallback) throw new BadRequestException('No task statuses configured for this organization');
    return fallback.id;
  }

  // ─── Create Task ──────────────────────────────────────────────────────────────

  async createTask(orgId: string, userId: string, dto: CreateTaskDto) {
    const config = await this.getOrgConfig(orgId);

    // Resolve status
    let statusId = dto.status_id;
    if (statusId) {
      const st = await this.prisma.taskStatus.findFirst({ where: { id: statusId, organization_id: orgId } });
      if (!st) throw new BadRequestException(`Status ${statusId} not found in this organization`);
    } else {
      statusId = await this.getDefaultStatusId(orgId);
    }

    const task = await this.prisma.task.create({
      data: {
        organization_id: orgId,
        created_by_user_id: userId,
        title: dto.title,
        description: dto.description,
        category_id: dto.category_id,
        priority_id: dto.priority_id,
        status_id: statusId,
        quadrant: dto.quadrant ?? 'Q2',
        type: dto.type ?? 'one_time',
        department_id: dto.department_id,
        completion_mode: dto.completion_mode ?? 'any_can_complete',
        proof_required: dto.proof_required ?? false,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
      include: TASK_INCLUDE,
    });

    // Create assignees
    const assigneeIds = dto.assignee_user_ids ?? [];
    const ccIds = dto.cc_user_ids ?? [];

    if (assigneeIds.length > 0) {
      await this.prisma.taskAssignee.createMany({
        data: assigneeIds.map((uid) => ({
          organization_id: orgId,
          task_id: task.id,
          user_id: uid,
          is_cc: false,
        })),
        skipDuplicates: true,
      });
    }

    if (ccIds.length > 0) {
      await this.prisma.taskAssignee.createMany({
        data: ccIds.map((uid) => ({
          organization_id: orgId,
          task_id: task.id,
          user_id: uid,
          is_cc: true,
        })),
        skipDuplicates: true,
      });
    }

    // Create checklist items
    if (dto.checklist_items && dto.checklist_items.length > 0) {
      await this.prisma.taskChecklist.createMany({
        data: dto.checklist_items.map((item) => ({
          organization_id: orgId,
          task_id: task.id,
          title: item.title,
          order_index: item.order_index,
        })),
      });
    }

    // Create escalation entries
    if (dto.escalation_user_ids && dto.escalation_user_ids.length > 0) {
      await this.prisma.taskEscalation.createMany({
        data: dto.escalation_user_ids.map((uid, idx) => ({
          organization_id: orgId,
          task_id: task.id,
          level: idx + 1,
          escalate_to_user_id: uid,
          is_active: true,
        })),
      });
    }

    // Create default reminder based on deadline and config
    if (task.deadline) {
      const remindAt = new Date(task.deadline);
      remindAt.setDate(remindAt.getDate() - config.default_reminder_days_before);
      if (remindAt > new Date()) {
        await this.prisma.taskReminder.create({
          data: {
            organization_id: orgId,
            task_id: task.id,
            remind_at: remindAt,
            type: 'assignee',
          },
        });
      }
    }

    // Log creation
    await this.logActivity(orgId, task.id, userId, 'created');

    return this.getTask(orgId, task.id);
  }

  // ─── List Tasks ───────────────────────────────────────────────────────────────

  async listTasks(
    orgId: string,
    userId: string,
    filters: {
      status_id?: string;
      priority_id?: string;
      category_id?: string;
      quadrant?: string;
      type?: string;
      assignee_user_id?: string;
      search?: string;
      from_date?: string;
      to_date?: string;
    },
  ) {
    const where: any = {
      organization_id: orgId,
      is_deleted: false,
    };

    if (filters.status_id) where.status_id = filters.status_id;
    if (filters.priority_id) where.priority_id = filters.priority_id;
    if (filters.category_id) where.category_id = filters.category_id;
    if (filters.quadrant) where.quadrant = filters.quadrant as any;
    if (filters.type) where.type = filters.type as any;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.from_date || filters.to_date) {
      where.deadline = {};
      if (filters.from_date) where.deadline.gte = new Date(filters.from_date);
      if (filters.to_date) where.deadline.lte = new Date(filters.to_date);
    }
    if (filters.assignee_user_id) {
      where.assignees = { some: { user_id: filters.assignee_user_id, is_cc: false } };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: { created_at: 'desc' },
    });

    return this.enrichTaskList(tasks);
  }

  async getMyTasks(orgId: string, userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        organization_id: orgId,
        is_deleted: false,
        assignees: { some: { user_id: userId, is_cc: false } },
      },
      include: TASK_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
    return this.enrichTaskList(tasks);
  }

  async getTasksAssignedByMe(orgId: string, userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { organization_id: orgId, is_deleted: false, created_by_user_id: userId },
      include: TASK_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
    return this.enrichTaskList(tasks);
  }

  async getEscalatedTasks(orgId: string, userId: string) {
    const escalations = await this.prisma.taskEscalation.findMany({
      where: { organization_id: orgId, escalate_to_user_id: userId, is_active: true, escalated_at: { not: null } },
      select: { task_id: true },
    });
    const taskIds = escalations.map((e) => e.task_id);
    if (taskIds.length === 0) return [];

    const tasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds }, is_deleted: false },
      include: TASK_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
    return this.enrichTaskList(tasks);
  }

  private async enrichTaskList(tasks: any[]) {
    const allUserIds = new Set<string>();
    for (const task of tasks) {
      task.created_by_user_id && allUserIds.add(task.created_by_user_id);
      for (const a of task.assignees ?? []) allUserIds.add(a.user_id);
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return tasks.map((task) => ({
      ...task,
      created_by: userMap.get(task.created_by_user_id) ?? null,
      assignees: (task.assignees ?? []).map((a: any) => ({ ...a, user: userMap.get(a.user_id) ?? null })),
    }));
  }

  // ─── Get Single Task ──────────────────────────────────────────────────────────

  async getTask(orgId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organization_id: orgId, is_deleted: false },
      include: {
        ...TASK_INCLUDE,
        activity_logs: { orderBy: { created_at: 'desc' } },
        comments: {
          where: { is_deleted: false, reply_to_comment_id: null },
          include: { replies: { where: { is_deleted: false } } },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    const allUserIds = new Set<string>();
    allUserIds.add(task.created_by_user_id);
    for (const a of task.assignees) allUserIds.add(a.user_id);
    for (const c of task.comments as any[]) {
      allUserIds.add(c.user_id);
      for (const r of c.replies ?? []) allUserIds.add(r.user_id);
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      ...task,
      created_by: userMap.get(task.created_by_user_id) ?? null,
      assignees: task.assignees.map((a) => ({ ...a, user: userMap.get(a.user_id) ?? null })),
      comments: (task.comments as any[]).map((c) => ({
        ...c,
        user: userMap.get(c.user_id) ?? null,
        replies: (c.replies ?? []).map((r: any) => ({ ...r, user: userMap.get(r.user_id) ?? null })),
      })),
    };
  }

  // ─── Update Task ──────────────────────────────────────────────────────────────

  async updateTask(orgId: string, userId: string, taskId: string, dto: UpdateTaskDto) {
    const old = await this.findTaskOrFail(orgId, taskId);
    const changedFields: Array<{ field: string; from: unknown; to: unknown }> = [];

    const updateData: any = {};

    const trackField = (field: string, oldVal: unknown, newVal: unknown) => {
      if (newVal !== undefined && newVal !== oldVal) {
        changedFields.push({ field, from: oldVal, to: newVal });
        updateData[field] = newVal;
      }
    };

    trackField('title', old.title, dto.title);
    trackField('description', old.description, dto.description);
    trackField('category_id', old.category_id, dto.category_id);
    trackField('priority_id', old.priority_id, dto.priority_id);
    trackField('quadrant', old.quadrant, dto.quadrant);
    trackField('type', old.type, dto.type);
    trackField('department_id', old.department_id, dto.department_id);
    trackField('completion_mode', old.completion_mode, dto.completion_mode);
    trackField('proof_required', old.proof_required, dto.proof_required);

    if (dto.deadline !== undefined) {
      const newDeadline = dto.deadline ? new Date(dto.deadline) : null;
      if (String(old.deadline) !== String(newDeadline)) {
        changedFields.push({ field: 'deadline', from: old.deadline, to: newDeadline });
        updateData.deadline = newDeadline;
      }
    }

    if (dto.status_id !== undefined && dto.status_id !== old.status_id) {
      const st = await this.prisma.taskStatus.findFirst({ where: { id: dto.status_id, organization_id: orgId } });
      if (!st) throw new BadRequestException(`Status ${dto.status_id} not found`);
      changedFields.push({ field: 'status_id', from: old.status_id, to: dto.status_id });
      updateData.status_id = dto.status_id;
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: TASK_INCLUDE,
    });

    if (changedFields.length > 0) {
      const action: TaskActionType = changedFields.some((f) => f.field === 'status_id') ? 'status_changed' : 'edited';
      await this.logActivity(orgId, taskId, userId, action, { changes: changedFields });
    }

    return updated;
  }

  // ─── Delete Task ──────────────────────────────────────────────────────────────

  async deleteTask(orgId: string, userId: string, taskId: string, reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Deletion reason is required');
    }

    const task = await this.findTaskOrFail(orgId, taskId);

    // Create archive snapshot
    await this.prisma.taskArchive.create({
      data: {
        organization_id: orgId,
        original_task_id: taskId,
        task_snapshot: task as any,
        deleted_by_user_id: userId,
        deletion_reason: reason,
        deleted_at: new Date(),
      },
    });

    // Soft delete
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        is_deleted: true,
        deleted_by_user_id: userId,
        deleted_at: new Date(),
        deletion_reason: reason,
      },
    });

    await this.logActivity(orgId, taskId, userId, 'deleted', { reason });

    return { message: 'Task deleted successfully' };
  }

  // ─── Complete Task ────────────────────────────────────────────────────────────

  async completeTask(orgId: string, userId: string, taskId: string) {
    const task = await this.findTaskOrFail(orgId, taskId);
    const config = await this.getOrgConfig(orgId);

    // Proof check
    if (task.proof_required && !task.proof_url) {
      throw new BadRequestException('Proof of completion is required before marking this task as done');
    }

    const completedStatus = await this.prisma.taskStatus.findFirst({
      where: { organization_id: orgId, type: 'completed', is_active: true },
      orderBy: { order_index: 'asc' },
    });

    if (task.completion_mode === CompletionMode.all_must_complete) {
      // Mark this assignee done
      await this.prisma.taskAssignee.updateMany({
        where: { task_id: taskId, user_id: userId, is_cc: false },
        data: { is_completed: true, completed_at: new Date() },
      });

      // Check if all assignees are done
      const pending = await this.prisma.taskAssignee.count({
        where: { task_id: taskId, is_cc: false, is_completed: false },
      });

      if (pending === 0 && completedStatus) {
        const now = new Date();
        const reopenExpiresAt = new Date(now.getTime() + config.reopen_window_minutes * 60_000);
        await this.prisma.task.update({
          where: { id: taskId },
          data: { status_id: completedStatus.id, reopen_expires_at: reopenExpiresAt },
        });
      }
    } else {
      // any_can_complete
      if (completedStatus) {
        const now = new Date();
        const reopenExpiresAt = new Date(now.getTime() + config.reopen_window_minutes * 60_000);
        await this.prisma.task.update({
          where: { id: taskId },
          data: { status_id: completedStatus.id, reopen_expires_at: reopenExpiresAt },
        });
      }
      await this.prisma.taskAssignee.updateMany({
        where: { task_id: taskId, user_id: userId, is_cc: false },
        data: { is_completed: true, completed_at: new Date() },
      });
    }

    await this.logActivity(orgId, taskId, userId, 'completed');
    return this.getTask(orgId, taskId);
  }

  // ─── Reopen Task ──────────────────────────────────────────────────────────────

  async reopenTask(orgId: string, userId: string, taskId: string) {
    const task = await this.findTaskOrFail(orgId, taskId);

    if (!task.reopen_expires_at || task.reopen_expires_at < new Date()) {
      throw new ForbiddenException('Reopen window has expired');
    }

    // Find ongoing / in-progress status
    const ongoingStatus = await this.prisma.taskStatus.findFirst({
      where: { organization_id: orgId, type: 'in_progress', is_active: true },
      orderBy: { order_index: 'asc' },
    });
    const defaultStatus = await this.prisma.taskStatus.findFirst({
      where: { organization_id: orgId, is_default: true, is_active: true },
      orderBy: { order_index: 'asc' },
    });
    const resetStatusId = ongoingStatus?.id ?? defaultStatus?.id ?? task.status_id;

    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status_id: resetStatusId,
        reopen_expires_at: null,
        reopened_at: new Date(),
      },
    });

    // Reset all assignee completion flags
    await this.prisma.taskAssignee.updateMany({
      where: { task_id: taskId },
      data: { is_completed: false, completed_at: null },
    });

    await this.logActivity(orgId, taskId, userId, 'reopened');
    return this.getTask(orgId, taskId);
  }

  // ─── Submit Proof ─────────────────────────────────────────────────────────────

  async submitProof(orgId: string, userId: string, taskId: string, proof_url: string) {
    await this.findTaskOrFail(orgId, taskId);
    await this.prisma.task.update({
      where: { id: taskId },
      data: { proof_url, proof_submitted_at: new Date() },
    });
    await this.logActivity(orgId, taskId, userId, 'proof_attached', { proof_url });
    return this.getTask(orgId, taskId);
  }

  // ─── Activity Logs ────────────────────────────────────────────────────────────

  async getActivityLog(orgId: string, taskId: string) {
    await this.findTaskOrFail(orgId, taskId);
    const logs = await this.prisma.taskActivityLog.findMany({
      where: { task_id: taskId, organization_id: orgId },
      orderBy: { created_at: 'desc' },
    });

    const userIds = [...new Set(logs.map((l) => l.performed_by_user_id))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return logs.map((l) => ({ ...l, performed_by: userMap.get(l.performed_by_user_id) ?? null }));
  }

  // ─── Comments ────────────────────────────────────────────────────────────────

  async getComments(orgId: string, taskId: string) {
    await this.findTaskOrFail(orgId, taskId);
    const comments = await this.prisma.taskComment.findMany({
      where: { task_id: taskId, organization_id: orgId, is_deleted: false, reply_to_comment_id: null },
      include: { replies: { where: { is_deleted: false }, orderBy: { created_at: 'asc' } } },
      orderBy: { created_at: 'asc' },
    });

    const allUserIds = new Set<string>();
    for (const c of comments) {
      allUserIds.add(c.user_id);
      for (const r of c.replies) allUserIds.add(r.user_id);
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return comments.map((c) => ({
      ...c,
      user: userMap.get(c.user_id) ?? null,
      replies: c.replies.map((r) => ({ ...r, user: userMap.get(r.user_id) ?? null })),
    }));
  }

  async addComment(orgId: string, userId: string, taskId: string, dto: CreateCommentDto) {
    await this.findTaskOrFail(orgId, taskId);
    const comment = await this.prisma.taskComment.create({
      data: {
        organization_id: orgId,
        task_id: taskId,
        user_id: userId,
        body: dto.body,
        reply_to_comment_id: dto.reply_to_comment_id,
        attachment_urls: dto.attachment_urls as any,
      },
    });
    await this.logActivity(orgId, taskId, userId, 'comment_added', { comment_id: comment.id });
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    return { ...comment, user };
  }

  async deleteComment(orgId: string, userId: string, commentId: string) {
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, organization_id: orgId },
    });
    if (!comment) throw new NotFoundException(`Comment ${commentId} not found`);
    if (comment.user_id !== userId) throw new ForbiddenException('Cannot delete another user\'s comment');

    await this.prisma.taskComment.update({
      where: { id: commentId },
      data: { is_deleted: true, deleted_at: new Date() },
    });
    await this.logActivity(orgId, comment.task_id, userId, 'comment_deleted', { comment_id: commentId });
    return { message: 'Comment deleted' };
  }

  // ─── Checklist ────────────────────────────────────────────────────────────────

  async toggleChecklistItem(orgId: string, userId: string, taskId: string, itemId: string) {
    await this.findTaskOrFail(orgId, taskId);
    const item = await this.prisma.taskChecklist.findFirst({
      where: { id: itemId, task_id: taskId, organization_id: orgId },
    });
    if (!item) throw new NotFoundException(`Checklist item ${itemId} not found`);

    const updated = await this.prisma.taskChecklist.update({
      where: { id: itemId },
      data: { is_completed: !item.is_completed },
    });
    await this.logActivity(orgId, taskId, userId, 'checklist_updated', {
      item_id: itemId,
      is_completed: updated.is_completed,
    });
    return updated;
  }

  // ─── Assignees ────────────────────────────────────────────────────────────────

  async addAssignee(orgId: string, userId: string, taskId: string, dto: AddAssigneeDto) {
    await this.findTaskOrFail(orgId, taskId);
    const assignee = await this.prisma.taskAssignee.upsert({
      where: { task_id_user_id: { task_id: taskId, user_id: dto.user_id } },
      create: {
        organization_id: orgId,
        task_id: taskId,
        user_id: dto.user_id,
        is_cc: dto.is_cc ?? false,
      },
      update: { is_cc: dto.is_cc ?? false },
    });
    await this.logActivity(orgId, taskId, userId, 'assigned', { user_id: dto.user_id, is_cc: dto.is_cc });
    return assignee;
  }

  async removeAssignee(orgId: string, userId: string, taskId: string, assigneeUserId: string) {
    await this.findTaskOrFail(orgId, taskId);
    const existing = await this.prisma.taskAssignee.findUnique({
      where: { task_id_user_id: { task_id: taskId, user_id: assigneeUserId } },
    });
    if (!existing) throw new NotFoundException(`Assignee ${assigneeUserId} not found on task`);
    await this.prisma.taskAssignee.delete({
      where: { task_id_user_id: { task_id: taskId, user_id: assigneeUserId } },
    });
    await this.logActivity(orgId, taskId, userId, 'reassigned', { removed_user_id: assigneeUserId });
    return { message: 'Assignee removed' };
  }

  // ─── Archive ─────────────────────────────────────────────────────────────────

  async getArchive(orgId: string) {
    return this.prisma.taskArchive.findMany({
      where: { organization_id: orgId },
      orderBy: { deleted_at: 'desc' },
    });
  }
}
