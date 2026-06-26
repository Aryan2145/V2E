import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompletionMode,
  DataScope,
  TaskActionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';
import { HolidaysService } from '../holidays/holidays.service';
import { ProjectProgressService } from '../projects/project-progress.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AssigneeVisibilityService } from '../assignee-visibility/assignee-visibility.service';
import { LeaveService } from '../leave/leave.service';
import { ClockService } from '../clock/clock.service';
import { SubjectEligibilityService } from '../access-rights/subject-eligibility.service';
import { ScopeService } from '../access-rights/scope.service';
import { Principal } from '../access-rights/permissions.service';
import { ChecklistAccessService } from '../task-masters/checklist-access.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AddAssigneeDto } from './dto/add-assignee.dto';
import { TERMINAL_TYPES, isSuccessful } from './status-phase';

const TASK_INCLUDE = {
  status: true,
  priority: true,
  category: true,
  assignees: true,
  checklist: { orderBy: { order_index: 'asc' as const } },
  escalations: true,
  reminders: true,
};

/** Shared filter shape for list / paged / dashboard task queries. */
export interface TaskListFilters {
  status_id?: string;
  priority_id?: string;
  category_id?: string;
  department_id?: string;
  created_by_user_id?: string;
  quadrant?: string;
  type?: string;
  assignee_user_id?: string;
  goal_id?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
}

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
    private readonly leave: LeaveService,
    private readonly clock: ClockService,
    private readonly checklistAccess: ChecklistAccessService,
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
    // A new task is always born in the single `not_started` status. Fall back to the
    // is_default flag, then the first active status, for older/partial orgs.
    const notStarted = await this.prisma.taskStatus.findFirst({
      where: { organization_id: orgId, type: 'not_started', is_active: true },
      orderBy: { order_index: 'asc' },
    });
    if (notStarted) return notStarted.id;
    const flagged = await this.prisma.taskStatus.findFirst({
      where: { organization_id: orgId, is_default: true, is_active: true },
      orderBy: { order_index: 'asc' },
    });
    if (flagged) return flagged.id;
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

    // Checklist template access: the creator may only apply a template they're
    // allowed to use (by department / role / explicit grant).
    if (dto.checklist_template_id) {
      const allowed = await this.checklistAccess.isAccessible(orgId, userId, dto.checklist_template_id);
      if (!allowed) {
        throw new ForbiddenException('You are not allowed to use this checklist template.');
      }
    }

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
    filters: TaskListFilters,
  ) {
    // Row-level data scope (own/team/department/org) at the actor's full entitlement.
    const scopeWhere = await this.scope.listWhere(orgId, principal, TasksService.TASK_LEAF);
    const where = this.buildTaskWhere(orgId, scopeWhere, filters, 'deadline');

    const tasks = await this.prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: { created_at: 'desc' },
    });

    return this.enrichTaskList(tasks);
  }

  /**
   * Shared task `where` builder for list / paged / dashboard queries. `scopeWhere` is the
   * already-resolved row-scope fragment (AND'd so it never clobbers the search OR).
   * `dateField` chooses whether the from/to range filters by deadline (legacy list) or
   * created_at (dashboard "period" semantics).
   */
  private buildTaskWhere(
    orgId: string,
    scopeWhere: Record<string, unknown>,
    filters: TaskListFilters,
    dateField: 'deadline' | 'created_at' = 'created_at',
  ): any {
    const where: any = { organization_id: orgId, is_deleted: false };
    if (scopeWhere && Object.keys(scopeWhere).length) where.AND = [scopeWhere];

    if (filters.goal_id) where.goal_id = filters.goal_id;
    if (filters.status_id) where.status_id = filters.status_id;
    if (filters.priority_id) where.priority_id = filters.priority_id;
    if (filters.category_id) where.category_id = filters.category_id;
    if (filters.department_id) where.department_id = filters.department_id;
    if (filters.created_by_user_id) where.created_by_user_id = filters.created_by_user_id;
    if (filters.quadrant) where.quadrant = filters.quadrant as any;
    if (filters.type) where.type = filters.type as any;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.from_date || filters.to_date) {
      const range: any = {};
      if (filters.from_date) range.gte = new Date(filters.from_date);
      if (filters.to_date) range.lte = new Date(filters.to_date);
      where[dateField] = range;
    }
    if (filters.assignee_user_id) {
      where.assignees = { some: { user_id: filters.assignee_user_id, is_cc: false } };
    }

    return where;
  }

  /**
   * Extra `where` fragment for a KPI "bucket" (overdue / due today / etc). Shared by the
   * dashboard counts and the paged list so a tile's number always matches the rows it opens.
   */
  private bucketWhere(bucket: string | undefined, now: Date): any {
    if (!bucket) return {};
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
    const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() - todayStart.getDay() + 7);
    const open = { status: { type: { notIn: TERMINAL_TYPES } } };
    switch (bucket) {
      case 'overdue': return { deadline: { lt: now }, ...open };
      case 'due_today': return { deadline: { gte: todayStart, lt: todayEnd }, ...open };
      case 'due_week': return { deadline: { gte: todayStart, lt: weekEnd }, ...open };
      case 'completed': return { status: { type: 'completed' } };
      case 'ongoing': return { status: { type: 'in_progress' } };
      case 'not_started': return { status: { type: 'not_started' } };
      case 'recurring': return { type: 'recurring' as any };
      default: return {};
    }
  }

  private taskOrderBy(sort?: string): any {
    switch (sort) {
      case 'deadline_asc': return [{ deadline: { sort: 'asc', nulls: 'last' } }];
      case 'deadline_desc': return [{ deadline: { sort: 'desc', nulls: 'last' } }];
      case 'created_asc': return { created_at: 'asc' };
      case 'updated_desc': return { updated_at: 'desc' };
      case 'created_desc':
      default: return { created_at: 'desc' };
    }
  }

  /**
   * Paginated task list for the Work dashboard's result surface. Scope is clamped to the
   * actor's entitlement (own/team/org switcher) and never widened past it. Returns a count
   * envelope so the client never loads the whole table — critical at org scale.
   */
  async listTasksPaged(
    orgId: string,
    principal: Principal,
    filters: TaskListFilters,
    requestedScope?: DataScope | null,
    page = 1,
    pageSize = 25,
    sort = 'created_desc',
    bucket?: string,
  ) {
    const { effective } = await this.scope.resolveListScope(orgId, principal, TasksService.TASK_LEAF, requestedScope);
    const scopeWhere = await this.scope.whereForScope(orgId, principal.userId, TasksService.TASK_LEAF, effective);
    const now = await this.clock.now(orgId);
    const where = { ...this.buildTaskWhere(orgId, scopeWhere, filters, 'created_at'), ...this.bucketWhere(bucket, now) };

    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({ where, include: TASK_INCLUDE, orderBy: this.taskOrderBy(sort), skip, take }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items: await this.enrichTaskList(items),
      total,
      page: Math.max(page, 1),
      page_size: take,
      has_more: skip + items.length < total,
    };
  }

  /**
   * Scope-aware dashboard aggregation for the Work canvas. Computes KPI counts and
   * dimension breakdowns with count()/groupBy() (never a full-table load), sim-clock aware.
   * `applied_scope` / `max_scope` let the client render the Mine/My Team/Organization switcher.
   */
  async getDashboard(
    orgId: string,
    principal: Principal,
    filters: TaskListFilters & { scope?: DataScope | null },
  ) {
    const { max, effective } = await this.scope.resolveListScope(orgId, principal, TasksService.TASK_LEAF, filters.scope);
    const scopeWhere = await this.scope.whereForScope(orgId, principal.userId, TasksService.TASK_LEAF, effective);
    const where = this.buildTaskWhere(orgId, scopeWhere, filters, 'created_at');

    // Empty / denied scope → zeroed dashboard (never leak counts).
    if (effective === null) {
      return {
        applied_scope: null,
        max_scope: max,
        kpis: { total: 0, not_started: 0, ongoing: 0, completed: 0, overdue: 0, due_today: 0, due_week: 0, recurring: 0 },
        by_status: [], by_priority: [], by_category: [], by_department: [], by_type: [],
        by_assignee: [], by_assigner: [], trend: [],
      };
    }

    const now = await this.clock.now(orgId);

    const [kpis, dims, by_assignee, by_assigner, trend] = await Promise.all([
      this.kpiFor(where, now),
      this.dimensionBreakdowns(orgId, where),
      this.assigneeBreakdown(where),
      this.assignerBreakdown(where),
      this.trendSeries(where, now),
    ]);

    return { applied_scope: effective, max_scope: max, kpis, ...dims, by_assignee, by_assigner, trend };
  }

  // ─── Dashboard helpers (shared by dashboard + employee report) ─────────────────

  /** The eight headline KPI counts for a task `where`, sim-clock aware. */
  private async kpiFor(where: any, now: Date) {
    const c = (bucket?: string) => this.prisma.task.count({ where: { ...where, ...this.bucketWhere(bucket, now) } });
    const [total, not_started, ongoing, completed, overdue, due_today, due_week, recurring] = await Promise.all([
      c(), c('not_started'), c('ongoing'), c('completed'), c('overdue'), c('due_today'), c('due_week'), c('recurring'),
    ]);
    return { total, not_started, ongoing, completed, overdue, due_today, due_week, recurring };
  }

  /** Status / priority / category / department / type breakdowns for a task `where`. */
  private async dimensionBreakdowns(orgId: string, where: any) {
    const [statusGroups, priorityGroups, categoryGroups, deptGroups, typeGroups] = await Promise.all([
      this.prisma.task.groupBy({ by: ['status_id'], where, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['priority_id'], where, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['category_id'], where, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['department_id'], where, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['type'], where, _count: { _all: true } }),
    ]);
    const [statuses, priorities, categories, depts] = await Promise.all([
      this.prisma.taskStatus.findMany({ where: { organization_id: orgId }, select: { id: true, label: true, color: true, type: true, order_index: true } }),
      this.prisma.taskPriority.findMany({ where: { organization_id: orgId }, select: { id: true, label: true, color: true, order_index: true } }),
      this.prisma.taskCategory.findMany({ where: { organization_id: orgId }, select: { id: true, name: true, color: true } }),
      this.prisma.department.findMany({
        where: { id: { in: deptGroups.map((g) => g.department_id).filter((x): x is string => !!x) } },
        select: { id: true, name: true, color: true },
      }),
    ]);
    const statusMap = new Map(statuses.map((s) => [s.id, s]));
    const priorityMap = new Map(priorities.map((p) => [p.id, p]));
    const categoryMap = new Map(categories.map((c2) => [c2.id, c2]));
    const deptMap = new Map(depts.map((d) => [d.id, d]));
    return {
      by_status: statusGroups
        .map((g) => {
          const s = statusMap.get(g.status_id);
          return { id: g.status_id, label: s?.label ?? 'Unknown', color: s?.color ?? '#94A3B8', type: s?.type ?? null, order_index: s?.order_index ?? 0, total: g._count._all };
        })
        .sort((a, b) => a.order_index - b.order_index),
      by_priority: priorityGroups
        .filter((g) => g.priority_id)
        .map((g) => {
          const p = priorityMap.get(g.priority_id!);
          return { id: g.priority_id, label: p?.label ?? 'Unknown', color: p?.color ?? '#94A3B8', order_index: p?.order_index ?? 0, total: g._count._all };
        })
        .sort((a, b) => a.order_index - b.order_index),
      by_category: categoryGroups
        .filter((g) => g.category_id)
        .map((g) => {
          const cat = categoryMap.get(g.category_id!);
          return { id: g.category_id, label: cat?.name ?? 'Uncategorized', color: cat?.color ?? '#94A3B8', total: g._count._all };
        }),
      by_department: deptGroups
        .filter((g) => g.department_id)
        .map((g) => {
          const d = deptMap.get(g.department_id!);
          return { id: g.department_id, label: d?.name ?? 'Unassigned', color: d?.color ?? '#94A3B8', total: g._count._all };
        }),
      by_type: typeGroups.map((g) => ({ id: g.type, label: g.type, total: g._count._all })),
    };
  }

  private async enrichUserNames(ids: (string | null | undefined)[]) {
    const uniq = [...new Set(ids.filter((x): x is string => !!x))];
    if (!uniq.length) return new Map<string, { id: string; name: string; email: string }>();
    const users = await this.prisma.user.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true, email: true } });
    return new Map(users.map((u) => [u.id, u]));
  }

  /** Top assignees (people receiving work) for a task `where`. */
  private async assigneeBreakdown(where: any, limit = 12) {
    const groups = await this.prisma.taskAssignee.groupBy({ by: ['user_id'], where: { is_cc: false, task: where }, _count: { _all: true } });
    const names = await this.enrichUserNames(groups.map((g) => g.user_id));
    return groups
      .map((g) => ({ id: g.user_id, label: names.get(g.user_id)?.name ?? 'Unknown', total: g._count._all }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  /** Top assigners (people giving work) for a task `where`. */
  private async assignerBreakdown(where: any, limit = 12) {
    const groups = await this.prisma.task.groupBy({ by: ['created_by_user_id'], where, _count: { _all: true } });
    const names = await this.enrichUserNames(groups.map((g) => g.created_by_user_id));
    return groups
      .map((g) => ({ id: g.created_by_user_id, label: names.get(g.created_by_user_id)?.name ?? 'Unknown', total: g._count._all }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  /** Weekly created-vs-completed series for the last `weeks` weeks (Sunday-start). */
  private async trendSeries(where: any, now: Date, weeks = 8) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - start.getDay());
    const baseWhere = { ...where };
    delete baseWhere.created_at; // the trend defines its own window
    const buckets = Array.from({ length: weeks }, (_, i) => {
      const from = new Date(start); from.setDate(from.getDate() - (weeks - 1 - i) * 7);
      const to = new Date(from); to.setDate(to.getDate() + 7);
      return { from, to };
    });
    return Promise.all(
      buckets.map(async ({ from, to }) => {
        const [created, completed] = await Promise.all([
          this.prisma.task.count({ where: { ...baseWhere, created_at: { gte: from, lt: to } } }),
          this.prisma.task.count({ where: { ...baseWhere, status: { type: 'completed' }, updated_at: { gte: from, lt: to } } }),
        ]);
        return { week: from.toISOString().slice(0, 10), created, completed };
      }),
    );
  }

  // ─── People tree (org-chart drill) ─────────────────────────────────────────────

  /**
   * Reporting tree of the people visible at `requestedScope`, each annotated with their
   * workload (as assignee: total/overdue/completed) and delegation count (as assigner),
   * computed over the tasks the VIEWER can see. The client assembles the tree from
   * `reporting_to_user_id` (a node whose parent isn't in the set is a root).
   */
  async getPeopleTree(
    orgId: string,
    principal: Principal,
    requestedScope: DataScope | null | undefined,
    filters: TaskListFilters,
  ) {
    const { effective } = await this.scope.resolveListScope(orgId, principal, TasksService.TASK_LEAF, requestedScope);
    if (effective === null) return { nodes: [], root_user_id: principal.userId };

    const visible = await this.scope.visibleUserIds(orgId, principal.userId, effective);
    const profiles = await this.prisma.employeeProfile.findMany({
      where: { organization_id: orgId, ...(visible === 'ALL' ? {} : { user_id: { in: visible } }) },
      select: {
        user_id: true,
        reporting_to_user_id: true,
        department: { select: { id: true, name: true } },
        role: { select: { title: true } },
      },
    });
    const userIds = profiles.map((p) => p.user_id);
    if (!userIds.length) return { nodes: [], root_user_id: principal.userId };

    const scopeWhere = await this.scope.whereForScope(orgId, principal.userId, TasksService.TASK_LEAF, effective);
    const base = this.buildTaskWhere(orgId, scopeWhere, filters, 'created_at');
    const now = await this.clock.now(orgId);
    const openTask = { status: { type: { notIn: TERMINAL_TYPES } } };

    const [names, aTotal, aOverdue, aDone, asg] = await Promise.all([
      this.enrichUserNames(userIds),
      this.prisma.taskAssignee.groupBy({ by: ['user_id'], where: { is_cc: false, user_id: { in: userIds }, task: base }, _count: { _all: true } }),
      this.prisma.taskAssignee.groupBy({ by: ['user_id'], where: { is_cc: false, user_id: { in: userIds }, task: { ...base, deadline: { lt: now }, ...openTask } }, _count: { _all: true } }),
      this.prisma.taskAssignee.groupBy({ by: ['user_id'], where: { is_cc: false, user_id: { in: userIds }, task: { ...base, status: { type: 'completed' } } }, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['created_by_user_id'], where: { ...base, created_by_user_id: { in: userIds } }, _count: { _all: true } }),
    ]);
    const cnt = (arr: any[], key: string) => new Map(arr.map((g) => [g[key], g._count._all]));
    const totM = cnt(aTotal, 'user_id'), ovM = cnt(aOverdue, 'user_id'), dnM = cnt(aDone, 'user_id'), asgM = cnt(asg, 'created_by_user_id');

    const nodes = profiles.map((p) => ({
      user_id: p.user_id,
      name: names.get(p.user_id)?.name ?? 'Unknown',
      role_title: p.role?.title ?? null,
      department_name: p.department?.name ?? null,
      reporting_to_user_id: p.reporting_to_user_id,
      assignee: { total: totM.get(p.user_id) ?? 0, overdue: ovM.get(p.user_id) ?? 0, completed: dnM.get(p.user_id) ?? 0 },
      assigned_count: asgM.get(p.user_id) ?? 0,
    }));
    return { nodes, root_user_id: principal.userId };
  }

  // ─── Employee work report (drill target) ───────────────────────────────────────

  /**
   * Per-employee work report, gated by the viewer's scope (403 if the target is outside
   * the viewer's visible set). Returns the employee's KPIs both as assignee ("their work")
   * and as assigner ("what they delegated"), over tasks the viewer can see.
   */
  async getEmployeeReport(orgId: string, principal: Principal, targetUserId: string, filters: TaskListFilters) {
    const { effective } = await this.scope.resolveListScope(orgId, principal, TasksService.TASK_LEAF, undefined);
    if (effective === null) throw new ForbiddenException('You do not have access to task data');
    const visible = await this.scope.visibleUserIds(orgId, principal.userId, effective);
    if (visible !== 'ALL' && !visible.includes(targetUserId)) {
      throw new ForbiddenException('This employee is outside your visibility scope');
    }

    const [user, profile] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, name: true, email: true } }),
      this.prisma.employeeProfile.findFirst({
        where: { organization_id: orgId, user_id: targetUserId },
        select: { department: { select: { name: true } }, role: { select: { title: true } } },
      }),
    ]);
    if (!user) throw new NotFoundException('Employee not found');

    const scopeWhere = await this.scope.whereForScope(orgId, principal.userId, TasksService.TASK_LEAF, effective);
    const base = this.buildTaskWhere(orgId, scopeWhere, filters, 'created_at');
    const now = await this.clock.now(orgId);
    const asAssignee = { ...base, assignees: { some: { user_id: targetUserId, is_cc: false } } };
    const asAssigner = { ...base, created_by_user_id: targetUserId };

    const [assigneeKpis, assignerKpis, assigneeDims] = await Promise.all([
      this.kpiFor(asAssignee, now),
      this.kpiFor(asAssigner, now),
      this.dimensionBreakdowns(orgId, asAssignee),
    ]);

    return {
      employee: { id: user.id, name: user.name, email: user.email, role_title: profile?.role?.title ?? null, department_name: profile?.department?.name ?? null },
      as_assignee: assigneeKpis,
      as_assigner: assignerKpis,
      assignee_breakdowns: assigneeDims,
    };
  }

  // ─── Bulk actions ──────────────────────────────────────────────────────────────

  /** Bulk status / deadline / complete over the subset of `taskIds` within the actor's scope. */
  async bulkUpdate(
    orgId: string,
    principal: Principal,
    taskIds: string[],
    action: 'status' | 'deadline' | 'complete',
    payload: { status_id?: string; deadline?: string | null },
  ) {
    if (!taskIds?.length) return { updated: 0 };
    const scopeWhere = await this.scope.listWhere(orgId, principal, TasksService.TASK_LEAF);
    const allowed = await this.prisma.task.findMany({
      where: { organization_id: orgId, is_deleted: false, id: { in: taskIds }, ...(Object.keys(scopeWhere).length ? { AND: [scopeWhere] } : {}) },
      select: { id: true },
    });
    const ids = allowed.map((t) => t.id);
    if (!ids.length) return { updated: 0 };

    let activity: TaskActionType = 'edited';
    if (action === 'status' && payload.status_id) {
      const st = await this.prisma.taskStatus.findFirst({ where: { id: payload.status_id, organization_id: orgId } });
      if (!st) throw new BadRequestException('Status not found');
      await this.prisma.task.updateMany({ where: { id: { in: ids } }, data: { status_id: payload.status_id } });
      activity = 'status_changed';
    } else if (action === 'deadline') {
      await this.prisma.task.updateMany({ where: { id: { in: ids } }, data: { deadline: payload.deadline ? new Date(payload.deadline) : null } });
    } else if (action === 'complete') {
      const completed = await this.prisma.taskStatus.findFirst({ where: { organization_id: orgId, type: 'completed', is_active: true }, orderBy: { order_index: 'asc' } });
      if (completed) await this.prisma.task.updateMany({ where: { id: { in: ids } }, data: { status_id: completed.id } });
      await this.prisma.taskAssignee.updateMany({ where: { task_id: { in: ids }, is_cc: false }, data: { is_completed: true, completed_at: new Date() } });
      activity = 'completed';
    } else {
      throw new BadRequestException('Unknown bulk action');
    }

    await Promise.all(ids.map((id) => this.logActivity(orgId, id, principal.userId, activity, { bulk: true }).catch(() => null)));
    return { updated: ids.length };
  }

  // ─── CSV export ────────────────────────────────────────────────────────────────

  /** Scope + filter aware CSV of the current view (capped). Returned as a JSON string field. */
  async exportCsv(
    orgId: string,
    principal: Principal,
    filters: TaskListFilters,
    requestedScope?: DataScope | null,
    bucket?: string,
  ) {
    const { effective } = await this.scope.resolveListScope(orgId, principal, TasksService.TASK_LEAF, requestedScope);
    const scopeWhere = await this.scope.whereForScope(orgId, principal.userId, TasksService.TASK_LEAF, effective);
    const now = await this.clock.now(orgId);
    const where = { ...this.buildTaskWhere(orgId, scopeWhere, filters, 'created_at'), ...this.bucketWhere(bucket, now) };
    const tasks = await this.prisma.task.findMany({ where, include: TASK_INCLUDE, orderBy: this.taskOrderBy('created_desc'), take: 5000 });
    const enriched = await this.enrichTaskList(tasks);

    const headers = ['Title', 'Status', 'Priority', 'Category', 'Type', 'Assigned By', 'Assignees', 'Deadline', 'Created'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.join(',')];
    for (const t of enriched as any[]) {
      lines.push([
        t.title,
        t.status?.label ?? '',
        t.priority?.label ?? '',
        t.category?.name ?? '',
        t.type,
        t.created_by?.name ?? '',
        (t.assignees ?? []).filter((a: any) => !a.is_cc).map((a: any) => a.user?.name).filter(Boolean).join('; '),
        t.deadline ? new Date(t.deadline).toISOString() : '',
        new Date(t.created_at).toISOString(),
      ].map(esc).join(','));
    }
    return { csv: lines.join('\n'), count: enriched.length };
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
        // Re-evaluate the persisted overdue flag; the auto-overdue sweep re-flags if it lapses again.
        const stillOverdue = !!newDeadline && newDeadline < new Date();
        if (old.is_overdue !== stillOverdue) {
          updateData.is_overdue = stillOverdue;
          updateData.overdue_at = stillOverdue ? new Date() : null;
        }
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
        // Clear the persisted overdue flag; the sweep re-flags if the deadline is still past.
        is_overdue: false,
        overdue_at: null,
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

    // "completed" = successful (drives completion counts); "terminal" = closed
    // (completed OR incomplete) — a closed task is never counted as overdue.
    const closingStatuses = await this.prisma.taskStatus.findMany({
      where: { organization_id: orgId, type: { in: TERMINAL_TYPES } },
      select: { id: true, type: true },
    });
    const completedIds = new Set(closingStatuses.filter((s) => isSuccessful(s.type)).map((s) => s.id));
    const terminalIds = new Set(closingStatuses.map((s) => s.id));
    const now = new Date();

    const userMap = new Map<string, { user_id: string; total: number; completed: number; overdue: number }>();
    const deptMap = new Map<string, { department_id: string; total: number; completed: number; overdue: number }>();
    const priorityMap = new Map<string, { label: string; color: string; total: number; completed: number; overdue: number }>();
    const categoryMap = new Map<string, { label: string; color: string; total: number; completed: number; overdue: number }>();
    const statusMap = new Map<string, { label: string; color: string; total: number }>();
    let recurringTotal = 0, recurringCompleted = 0, oneTimeTotal = 0, oneTimeCompleted = 0;

    for (const task of tasks) {
      const isCompleted = completedIds.has(task.status_id);
      const isOverdue = !!task.deadline && task.deadline < now && !terminalIds.has(task.status_id);

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
            task: { is_deleted: false, status: { type: { notIn: TERMINAL_TYPES } } },
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

    // Who is on leave right now (sim-clock aware) — annotates the picker, never filters it.
    const now = await this.clock.now(orgId);
    const onLeaveMap = await this.leave.onLeaveTodayMap(orgId, eligibleUserIdArray, now);

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
      on_leave_today: onLeaveMap.has(p.user_id),
      leave_until: onLeaveMap.get(p.user_id) ?? null,
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

  /**
   * Admin preview: the resolved Assignees & CC list for ANY employee, with a per-person
   * reason and the "removed by manual override" strip. Powers the per-employee editor on
   * the masters page. Gated by `tasks.config.assignee_visibility.manage` at the route.
   */
  async getEmployeeAssigneePreview(orgId: string, targetUserId: string, search?: string) {
    const [{ pool, trace, provenance, removed }, profileMap, override] = await Promise.all([
      this.assigneeVisibility.resolve(orgId, targetUserId),
      this.assigneeVisibility.getProfiles(orgId),
      this.assigneeVisibility.getEmployeeManualOverride(orgId, targetUserId),
    ]);
    const target = profileMap.get(targetUserId) ?? null;

    let eligibleProfiles = [...pool]
      .map((id) => profileMap.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p);
    if (search?.trim()) {
      const q = search.toLowerCase();
      eligibleProfiles = eligibleProfiles.filter((p) => p.name.toLowerCase().includes(q));
    }

    const ids = eligibleProfiles.map((p) => p.user_id);
    const activeTasks = ids.length
      ? await this.prisma.taskAssignee.findMany({
          where: {
            organization_id: orgId,
            is_cc: false,
            user_id: { in: ids },
            task: { is_deleted: false, status: { type: { notIn: TERMINAL_TYPES } } },
          },
          select: { user_id: true },
        })
      : [];
    const activeTaskMap = new Map<string, number>();
    for (const ta of activeTasks) activeTaskMap.set(ta.user_id, (activeTaskMap.get(ta.user_id) ?? 0) + 1);

    const frequencies = ids.length
      ? await this.prisma.taskAssigneeFrequency.findMany({
          where: { organization_id: orgId, assigner_user_id: targetUserId, assignee_user_id: { in: ids } },
          select: { assignee_user_id: true, frequency_count: true },
        })
      : [];
    const frequencyMap = new Map(frequencies.map((f) => [f.assignee_user_id, f.frequency_count]));
    const frequentUserIds = new Set(
      [...frequencyMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, c]) => c > 0).map(([id]) => id),
    );

    const now = await this.clock.now(orgId);
    const onLeaveMap = await this.leave.onLeaveTodayMap(orgId, ids, now);
    const addedSet = new Set(override.added_user_ids);

    const items = eligibleProfiles
      .map((p) => ({
        user_id: p.user_id,
        name: p.name,
        avatar_url: null as null,
        role_title: p.role_title,
        department_id: p.department_id,
        department_name: p.department_name,
        active_task_count: activeTaskMap.get(p.user_id) ?? 0,
        frequency_count: frequencyMap.get(p.user_id) ?? 0,
        is_frequent: frequentUserIds.has(p.user_id),
        on_leave_today: onLeaveMap.has(p.user_id),
        leave_until: onLeaveMap.get(p.user_id) ?? null,
        reason: provenance.get(p.user_id) ?? 'department',
        manually_added: addedSet.has(p.user_id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const deptMap = new Map<string, { department_id: string; department_name: string; users: typeof items }>();
    for (const item of items) {
      if (!deptMap.has(item.department_id)) {
        deptMap.set(item.department_id, { department_id: item.department_id, department_name: item.department_name, users: [] });
      }
      deptMap.get(item.department_id)!.users.push(item);
    }

    const removedItems = removed.map((r) => {
      const rp = profileMap.get(r.user_id);
      return {
        user_id: r.user_id,
        name: rp?.name ?? 'Unknown',
        role_title: rp?.role_title ?? '',
        department_id: rp?.department_id ?? '',
        department_name: rp?.department_name ?? '',
        would_be_reason: r.would_be_reason,
      };
    });

    return {
      employee: target
        ? {
            user_id: target.user_id,
            name: target.name,
            role_title: target.role_title,
            department_id: target.department_id,
            department_name: target.department_name,
          }
        : { user_id: targetUserId, name: 'Unknown', role_title: '', department_id: '', department_name: '' },
      trace,
      override,
      departments: Array.from(deptMap.values()),
      removed: removedItems,
      total: items.length,
    };
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
