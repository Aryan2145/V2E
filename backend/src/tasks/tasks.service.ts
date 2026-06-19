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
import { WorkflowEngineService } from '../workflows/workflow-engine.service';
import { HolidaysService } from '../holidays/holidays.service';
import { ProjectProgressService } from '../projects/project-progress.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AssigneeVisibilityService } from '../assignee-visibility/assignee-visibility.service';
import { SubjectEligibilityService } from '../access-rights/subject-eligibility.service';
import { ScopeService } from '../access-rights/scope.service';
import { Principal } from '../access-rights/permissions.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly holidaysService: HolidaysService,
    private readonly projectProgressService: ProjectProgressService,
    private readonly notifications: NotificationsService,
    private readonly assigneeVisibility: AssigneeVisibilityService,
    private readonly subjects: SubjectEligibilityService,
    private readonly scope: ScopeService,
  ) {
    this.scope.registerWiredList(TasksService.TASK_LEAF);
  }

  /** The subject leaf governing "can be assigned a task". */
  private static readonly TASK_SUBJECT = 'tasks.subject.assignable';
  /** The content leaf governing task row-level scope. */
  private static readonly TASK_LEAF = 'tasks.task.manage';

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async checkTaskPermission(
    orgId: string,
    userId: string,
    field: 'task_creation_roles' | 'task_edit_roles' | 'task_delete_roles' | 'archive_view_roles',
  ) {
    const [config, member] = await Promise.all([
      this.getOrgConfig(orgId),
      this.prisma.organizationMember.findUnique({
        where: { organization_id_user_id: { organization_id: orgId, user_id: userId } },
        select: { is_admin: true },
      }),
    ]);
    if (!member) throw new ForbiddenException('Not a member of this organization');
    const allowedRoles = config[field] as string[];
    // MemberRole-collapse translation: an "employee"-inclusive config stays open to
    // every member; otherwise the action is restricted to platform admins.
    const allowed = Array.isArray(allowedRoles) && (allowedRoles.includes('employee') || member.is_admin);
    if (!allowed) {
      throw new ForbiddenException(`Your role is not permitted to perform this action`);
    }
  }

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
    await this.checkTaskPermission(orgId, userId, 'task_creation_roles');
    const config = await this.getOrgConfig(orgId);

    // Subject eligibility (fail loud, before any writes): every assignee must be
    // eligible to be assigned a task — even if they have no Tasks actor access.
    await this.subjects.assertAllEligible(orgId, TasksService.TASK_SUBJECT, dto.assignee_user_ids ?? []);

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
        goal_id: dto.goal_id,
      },
      include: TASK_INCLUDE,
    });

    // Holiday deadline adjustment (after create so we have task.id for audit log)
    if (dto.deadline) {
      const rawDeadline = new Date(dto.deadline);
      const adjusted = await this.holidaysService.adjustDeadline(
        rawDeadline, orgId,
        dto.department_id, dto.assignee_user_ids?.[0],
        'task', task.id, task.title,
      );
      if (adjusted === null) {
        await this.prisma.task.delete({ where: { id: task.id } });
        throw new BadRequestException(
          'Deadline falls on a non-working day. Org settings prevent task creation on holidays. Please select a different date.',
        );
      }
      if (adjusted.getTime() !== rawDeadline.getTime()) {
        await this.prisma.task.update({ where: { id: task.id }, data: { deadline: adjusted } });
        (task as any).deadline = adjusted;
      }
    }

    // Create assignees
    const assigneeIds = dto.assignee_user_ids ?? [];
    const ccIds = dto.cc_user_ids ?? [];

    if (assigneeIds.length === 0) {
      await this.prisma.task.delete({ where: { id: task.id } });
      throw new BadRequestException('At least one assignee is required. CC-only tasks are not allowed.');
    }

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

    // Upsert frequency counts for non-CC assignees
    if (assigneeIds.length > 0) {
      await Promise.all(
        assigneeIds.map((assigneeUserId) =>
          this.prisma.taskAssigneeFrequency.upsert({
            where: {
              organization_id_assigner_user_id_assignee_user_id: {
                organization_id: orgId,
                assigner_user_id: userId,
                assignee_user_id: assigneeUserId,
              },
            },
            create: {
              organization_id: orgId,
              assigner_user_id: userId,
              assignee_user_id: assigneeUserId,
              frequency_count: 1,
              last_assigned_at: new Date(),
            },
            update: {
              frequency_count: { increment: 1 },
              last_assigned_at: new Date(),
            },
          }).catch(() => null), // ignore if constraint fails on race condition
        ),
      );
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

    // Notify assignees + CC (excluding the creator)
    const creatorName = await this.notifications.userName(userId);
    await this.notifications.emit({
      orgId,
      module: 'tasks',
      event_type: 'task_assigned',
      recipients: assigneeIds.filter((uid) => uid !== userId),
      title: 'New task assigned',
      body: `${creatorName} assigned you "${task.title}"`,
      link: `/dashboard/tasks/${task.id}`,
      entity: { type: 'task', id: task.id },
    });
    await this.notifications.emit({
      orgId,
      module: 'tasks',
      event_type: 'task_assigned',
      recipients: ccIds.filter((uid) => uid !== userId),
      title: "You're CC'd on a task",
      body: `${creatorName} CC'd you on "${task.title}"`,
      link: `/dashboard/tasks/${task.id}`,
      entity: { type: 'task', id: task.id },
    });

    return this.getTask(orgId, task.id);
  }

  // ─── List Tasks ───────────────────────────────────────────────────────────────

  async listTasks(
    orgId: string,
    principal: Principal,
    filters: {
      status_id?: string;
      priority_id?: string;
      category_id?: string;
      quadrant?: string;
      type?: string;
      assignee_user_id?: string;
      goal_id?: string;
      search?: string;
      from_date?: string;
      to_date?: string;
    },
  ) {
    const where: any = {
      organization_id: orgId,
      is_deleted: false,
    };

    // Row-level data scope (own/team/department/org) — AND'd so it never clobbers
    // the search OR or assignee filter below.
    const scopeWhere = await this.scope.listWhere(orgId, principal, TasksService.TASK_LEAF);
    if (Object.keys(scopeWhere).length) where.AND = [scopeWhere];

    if (filters.goal_id) where.goal_id = filters.goal_id;
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

  async getMyCCTasks(orgId: string, userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        organization_id: orgId,
        is_deleted: false,
        assignees: { some: { user_id: userId, is_cc: true } },
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
    const allOrgIds = new Set<string>();
    for (const task of tasks) {
      task.organization_id && allOrgIds.add(task.organization_id);
      task.created_by_user_id && allUserIds.add(task.created_by_user_id);
      for (const a of task.assignees ?? []) allUserIds.add(a.user_id);
    }
    const userIds = Array.from(allUserIds);
    // Profiles are per-org, so key them by org+user (collective view spans orgs).
    const [users, profiles] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      }),
      this.prisma.employeeProfile.findMany({
        where: { organization_id: { in: Array.from(allOrgIds) }, user_id: { in: userIds } },
        select: {
          organization_id: true,
          user_id: true,
          department: { select: { name: true } },
          role: { select: { title: true } },
        },
      }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const profileMap = new Map(profiles.map((p) => [`${p.organization_id}:${p.user_id}`, p]));

    return tasks.map((task) => ({
      ...task,
      created_by: userMap.get(task.created_by_user_id) ?? null,
      assignees: (task.assignees ?? []).map((a: any) => {
        const u = userMap.get(a.user_id);
        const p = profileMap.get(`${task.organization_id}:${a.user_id}`);
        return {
          ...a,
          user: u
            ? { ...u, department: p?.department?.name ?? null, role_title: p?.role?.title ?? null }
            : null,
        };
      }),
    }));
  }

  /**
   * Map of taskId → whether the task is in a "completed"-type status.
   * Used by other modules (e.g. Meetings action items) to compute done-ness.
   */
  async areCompleted(orgId: string, taskIds: string[]): Promise<Record<string, boolean>> {
    const ids = [...new Set(taskIds.filter(Boolean))];
    if (!ids.length) return {};
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: ids }, organization_id: orgId, is_deleted: false },
      select: { id: true, status: { select: { type: true } } },
    });
    const map: Record<string, boolean> = {};
    for (const t of tasks) map[t.id] = t.status?.type === 'completed';
    return map;
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
      comments: (task.comments as any[]).map((c) => {
        const cu = userMap.get(c.user_id);
        return {
          ...c,
          user_name: cu?.name ?? null,
          user_email: cu?.email ?? null,
          user: cu ?? null,
          replies: (c.replies ?? []).map((r: any) => {
            const ru = userMap.get(r.user_id);
            return { ...r, user_name: ru?.name ?? null, user_email: ru?.email ?? null, user: ru ?? null };
          }),
        };
      }),
    };
  }

  // ─── Update Task ──────────────────────────────────────────────────────────────

  async updateTask(orgId: string, userId: string, taskId: string, dto: UpdateTaskDto) {
    const old = await this.findTaskOrFail(orgId, taskId);
    if (old.created_by_user_id !== userId) {
      await this.checkTaskPermission(orgId, userId, 'task_edit_roles');
    }
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
    trackField('goal_id', old.goal_id, dto.goal_id);

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
    await this.checkTaskPermission(orgId, userId, 'task_delete_roles');
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

    // Notify creator + co-assignees (excluding whoever completed it)
    const completerName = await this.notifications.userName(userId);
    await this.notifications.emit({
      orgId,
      module: 'tasks',
      event_type: 'task_completed',
      recipients: [
        task.created_by_user_id,
        ...(task.assignees ?? []).filter((a: any) => !a.is_cc).map((a: any) => a.user_id),
      ].filter((uid) => uid !== userId),
      title: 'Task completed',
      body: `${completerName} completed "${task.title}"`,
      link: `/dashboard/tasks/${taskId}`,
      entity: { type: 'task', id: taskId },
    });

    // Advance workflow if this task belongs to a workflow step
    if (task.workflow_instance_step_id) {
      await this.workflowEngine.handleStepCompleted(task.workflow_instance_step_id);
    }

    // Recalculate project progress if task is linked to a project
    const projectTask = await this.prisma.projectTask.findFirst({ where: { task_id: taskId } });
    if (projectTask) {
      await this.projectProgressService.recalculateProjectProgress(projectTask.project_id);
    }

    return this.getTask(orgId, taskId);
  }

  // ─── Reopen Task ──────────────────────────────────────────────────────────────

  async reopenTask(orgId: string, userId: string, taskId: string, reason?: string) {
    const task = await this.findTaskOrFail(orgId, taskId);

    const isCreator = task.created_by_user_id === userId;

    if (isCreator) {
      if (!reason?.trim()) {
        throw new BadRequestException('A reason is required when the task creator reopens a task.');
      }
    } else {
      if (!task.reopen_expires_at || task.reopen_expires_at < new Date()) {
        throw new ForbiddenException('Reopen window has expired. Only the task creator can reopen after this point.');
      }
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

    await this.logActivity(orgId, taskId, userId, 'reopened', reason ? { reason } : undefined);

    // Notify assignees + creator (excluding whoever reopened it)
    const reopenerName = await this.notifications.userName(userId);
    await this.notifications.emit({
      orgId,
      module: 'tasks',
      event_type: 'task_reopened',
      recipients: [
        task.created_by_user_id,
        ...(task.assignees ?? []).filter((a: any) => !a.is_cc).map((a: any) => a.user_id),
      ].filter((uid) => uid !== userId),
      title: 'Task reopened',
      body: `${reopenerName} reopened "${task.title}"${reason ? ` — ${reason}` : ''}`,
      link: `/dashboard/tasks/${taskId}`,
      entity: { type: 'task', id: taskId },
    });

    // Recalculate project progress if task is linked to a project
    const projectTaskReopened = await this.prisma.projectTask.findFirst({ where: { task_id: taskId } });
    if (projectTaskReopened) {
      await this.projectProgressService.recalculateProjectProgress(projectTaskReopened.project_id);
    }

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

    return comments.map((c) => {
      const u = userMap.get(c.user_id);
      return {
        ...c,
        user_name: u?.name ?? null,
        user_email: u?.email ?? null,
        user: u ?? null,
        replies: c.replies.map((r) => {
          const ru = userMap.get(r.user_id);
          return { ...r, user_name: ru?.name ?? null, user_email: ru?.email ?? null, user: ru ?? null };
        }),
      };
    });
  }

  async addComment(orgId: string, userId: string, taskId: string, dto: CreateCommentDto) {
    const task = await this.findTaskOrFail(orgId, taskId);
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

    // Notify everyone on the task (assignees + CC + creator) except the commenter
    const snippet = dto.body.length > 80 ? `${dto.body.slice(0, 80)}…` : dto.body;
    await this.notifications.emit({
      orgId,
      module: 'tasks',
      event_type: 'task_comment',
      recipients: [
        task.created_by_user_id,
        ...(task.assignees ?? []).map((a: any) => a.user_id),
      ].filter((uid) => uid !== userId),
      title: `New comment on "${task.title}"`,
      body: `${user?.name ?? 'Someone'}: ${snippet}`,
      link: `/dashboard/tasks/${taskId}`,
      entity: { type: 'task', id: taskId },
    });

    return { ...comment, user_name: user?.name ?? null, user_email: user?.email ?? null, user: user ?? null };
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
    const task = await this.findTaskOrFail(orgId, taskId);
    // A real assignee (not a CC) must be eligible to be assigned a task. Fail loud.
    if (!dto.is_cc) {
      await this.subjects.assertEligible(orgId, TasksService.TASK_SUBJECT, dto.user_id);
    }
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

    if (dto.user_id !== userId) {
      const assignerName = await this.notifications.userName(userId);
      await this.notifications.emit({
        orgId,
        module: 'tasks',
        event_type: 'task_assigned',
        recipients: [dto.user_id],
        title: dto.is_cc ? "You're CC'd on a task" : 'New task assigned',
        body: `${assignerName} ${dto.is_cc ? "CC'd you on" : 'assigned you'} "${task.title}"`,
        link: `/dashboard/tasks/${taskId}`,
        entity: { type: 'task', id: taskId },
      });
    }
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

  async getArchive(orgId: string, userId: string) {
    await this.checkTaskPermission(orgId, userId, 'archive_view_roles');
    const items = await this.prisma.taskArchive.findMany({
      where: { organization_id: orgId },
      orderBy: { deleted_at: 'desc' },
    });
    // Resolve the deleting users' names for display.
    const userIds = Array.from(new Set(items.map((i) => i.deleted_by_user_id)));
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return items.map((i) => ({ ...i, deleted_by: userMap.get(i.deleted_by_user_id) ?? null }));
  }

  // ─── Reports ─────────────────────────────────────────────────────────────────

  async getReports(orgId: string, fromDate?: string, toDate?: string) {
    const where: any = { organization_id: orgId, is_deleted: false };
    if (fromDate || toDate) {
      where.created_at = {};
      if (fromDate) where.created_at.gte = new Date(fromDate);
      if (toDate) where.created_at.lte = new Date(toDate);
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        status: true,
        priority: true,
        category: true,
        assignees: { where: { is_cc: false } },
      },
    });

    const completedStatuses = await this.prisma.taskStatus.findMany({
      where: { organization_id: orgId, type: 'completed' },
      select: { id: true },
    });
    const completedIds = new Set(completedStatuses.map((s) => s.id));
    const now = new Date();

    const userMap = new Map<string, { user_id: string; total: number; completed: number; overdue: number }>();
    const deptMap = new Map<string, { department_id: string; total: number; completed: number; overdue: number }>();
    const priorityMap = new Map<string, { label: string; color: string; total: number; completed: number; overdue: number }>();
    const categoryMap = new Map<string, { label: string; color: string; total: number; completed: number; overdue: number }>();
    const statusMap = new Map<string, { label: string; color: string; total: number }>();
    let recurringTotal = 0, recurringCompleted = 0, oneTimeTotal = 0, oneTimeCompleted = 0;

    for (const task of tasks) {
      const isCompleted = completedIds.has(task.status_id);
      const isOverdue = !!task.deadline && task.deadline < now && !isCompleted;

      if (task.priority_id && task.priority) {
        if (!priorityMap.has(task.priority_id)) {
          priorityMap.set(task.priority_id, { label: task.priority.label, color: task.priority.color, total: 0, completed: 0, overdue: 0 });
        }
        const p = priorityMap.get(task.priority_id)!;
        p.total++; if (isCompleted) p.completed++; if (isOverdue) p.overdue++;
      }

      if (task.category_id && task.category) {
        if (!categoryMap.has(task.category_id)) {
          categoryMap.set(task.category_id, { label: task.category.name, color: task.category.color, total: 0, completed: 0, overdue: 0 });
        }
        const c = categoryMap.get(task.category_id)!;
        c.total++; if (isCompleted) c.completed++; if (isOverdue) c.overdue++;
      }

      if (task.status) {
        if (!statusMap.has(task.status_id)) {
          statusMap.set(task.status_id, { label: task.status.label, color: task.status.color, total: 0 });
        }
        statusMap.get(task.status_id)!.total++;
      }

      for (const a of task.assignees) {
        if (!userMap.has(a.user_id)) {
          userMap.set(a.user_id, { user_id: a.user_id, total: 0, completed: 0, overdue: 0 });
        }
        const u = userMap.get(a.user_id)!;
        u.total++; if (isCompleted) u.completed++; if (isOverdue) u.overdue++;
      }

      if (task.department_id) {
        if (!deptMap.has(task.department_id)) {
          deptMap.set(task.department_id, { department_id: task.department_id, total: 0, completed: 0, overdue: 0 });
        }
        const d = deptMap.get(task.department_id)!;
        d.total++; if (isCompleted) d.completed++; if (isOverdue) d.overdue++;
      }

      if (task.type === 'recurring') {
        recurringTotal++; if (isCompleted) recurringCompleted++;
      } else {
        oneTimeTotal++; if (isCompleted) oneTimeCompleted++;
      }
    }

    const userIds = Array.from(userMap.keys());
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [];
    const userEnrich = new Map(users.map((u) => [u.id, u]));

    const deptIds = Array.from(deptMap.keys());
    const depts = deptIds.length > 0
      ? await this.prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
      : [];
    const deptEnrich = new Map(depts.map((d) => [d.id, d]));

    return {
      total_tasks: tasks.length,
      user_performance: Array.from(userMap.entries()).map(([id, data]) => ({
        ...data,
        user: userEnrich.get(id) ?? null,
      })),
      department_performance: Array.from(deptMap.entries()).map(([id, data]) => ({
        ...data,
        department: deptEnrich.get(id) ?? null,
      })),
      priority_breakdown: Array.from(priorityMap.values()),
      category_breakdown: Array.from(categoryMap.values()),
      status_breakdown: Array.from(statusMap.values()),
      frequency_breakdown: {
        recurring: { total: recurringTotal, completed: recurringCompleted },
        one_time: { total: oneTimeTotal, completed: oneTimeCompleted },
      },
    };
  }

  // ─── Eligible Assignees ───────────────────────────────────────────────────────

  async getEligibleAssignees(
    orgId: string,
    userId: string,
    search?: string,
    sort: 'frequency' | 'workload' | 'name' = 'frequency',
  ) {
    // Membership is resolved (and cached) by AssigneeVisibilityService following the
    // override → full-visibility → exception → base default → bridges → excludes pipeline.
    const [{ pool }, profileMap] = await Promise.all([
      this.assigneeVisibility.resolve(orgId, userId),
      this.assigneeVisibility.getProfiles(orgId),
    ]);

    let eligibleProfiles = [...pool]
      .map((id) => profileMap.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    if (search?.trim()) {
      const q = search.toLowerCase();
      eligibleProfiles = eligibleProfiles.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Get active task counts
    const eligibleUserIdArray = eligibleProfiles.map((p) => p.user_id);
    const activeTasks = eligibleUserIdArray.length > 0
      ? await this.prisma.taskAssignee.findMany({
          where: {
            organization_id: orgId,
            is_cc: false,
            user_id: { in: eligibleUserIdArray },
            task: { is_deleted: false, status: { type: { not: 'completed' } } },
          },
          select: { user_id: true },
        })
      : [];

    const activeTaskMap = new Map<string, number>();
    for (const ta of activeTasks) {
      activeTaskMap.set(ta.user_id, (activeTaskMap.get(ta.user_id) ?? 0) + 1);
    }

    // Get frequency counts
    const frequencies = eligibleUserIdArray.length > 0
      ? await this.prisma.taskAssigneeFrequency.findMany({
          where: { organization_id: orgId, assigner_user_id: userId, assignee_user_id: { in: eligibleUserIdArray } },
          select: { assignee_user_id: true, frequency_count: true },
        })
      : [];
    const frequencyMap = new Map(frequencies.map((f) => [f.assignee_user_id, f.frequency_count]));

    // Top 3 by frequency = is_frequent
    const sortedFreq = [...frequencyMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const frequentUserIds = new Set(sortedFreq.filter(([, c]) => c > 0).map(([id]) => id));

    const items = eligibleProfiles.map((p) => ({
      user_id: p.user_id,
      name: p.name,
      avatar_url: null as null,
      role_title: p.role_title,
      department_id: p.department_id,
      department_name: p.department_name,
      active_task_count: activeTaskMap.get(p.user_id) ?? 0,
      frequency_count: frequencyMap.get(p.user_id) ?? 0,
      is_frequent: frequentUserIds.has(p.user_id),
    }));

    let sorted: typeof items;
    if (sort === 'frequency') {
      sorted = items.sort((a, b) => b.frequency_count - a.frequency_count || a.name.localeCompare(b.name));
    } else if (sort === 'workload') {
      sorted = items.sort((a, b) => a.active_task_count - b.active_task_count || a.name.localeCompare(b.name));
    } else {
      sorted = items.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Group by department (flat list when searching)
    if (search?.trim()) {
      return { departments: [{ department_id: 'search', department_name: 'Results', users: sorted }], total: sorted.length };
    }

    const deptMap = new Map<string, { department_id: string; department_name: string; users: typeof items }>();
    for (const item of sorted) {
      if (!deptMap.has(item.department_id)) {
        deptMap.set(item.department_id, { department_id: item.department_id, department_name: item.department_name, users: [] });
      }
      deptMap.get(item.department_id)!.users.push(item);
    }

    return { departments: Array.from(deptMap.values()), total: sorted.length };
  }

  // ─── Collective (cross-org) ───────────────────────────────────────────────────

  async getCollectiveTasks(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { user_id: userId, is_active: true },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });

    return Promise.all(
      memberships.map(async (m) => {
        const tasks = await this.prisma.task.findMany({
          where: { organization_id: m.organization_id, is_deleted: false },
          include: {
            status: true,
            priority: true,
            category: true,
            assignees: true,
          },
          orderBy: { created_at: 'desc' },
          take: 100,
        });
        return {
          organization: m.organization,
          is_admin: m.is_admin,
          tasks: await this.enrichTaskList(tasks),
        };
      }),
    );
  }
}
