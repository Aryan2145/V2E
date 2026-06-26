import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataScope,
  GoalCadence,
  GoalConfidence,
  GoalLevel,
  GoalPerspective,
  GoalStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SubjectEligibilityService } from '../access-rights/subject-eligibility.service';
import { ScopeService } from '../access-rights/scope.service';
import { AccessVisibilityService } from '../access-rights/access-visibility.service';
import { Principal } from '../access-rights/permissions.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { CreateGoalCheckInDto } from './dto/create-check-in.dto';

const PERSPECTIVES: GoalPerspective[] = [
  'financial',
  'customer',
  'internal_process',
  'learning_growth',
];

export interface GoalListFilters {
  level?: GoalLevel;
  perspective?: GoalPerspective;
  owner_user_id?: string;
  parent_goal_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

@Injectable()
export class GoalsService {
  private static readonly GOALS_LEAF = 'goals';

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly subjects: SubjectEligibilityService,
    private readonly scope: ScopeService,
    private readonly visibility: AccessVisibilityService,
  ) {
    this.scope.registerWiredList(GoalsService.GOALS_LEAF);
    this.visibility.registerCounter(GoalsService.GOALS_LEAF, (orgId, userId) =>
      this.prisma.goal.count({
        where: {
          organization_id: orgId,
          is_deleted: false,
          ...(this.visibility.whereForUser(GoalsService.GOALS_LEAF, userId) ?? {}),
        },
      }),
    );
  }

  // ─── Create ───────────────────────────────────────────────────────────────
  async create(orgId: string, userId: string, dto: CreateGoalDto) {
    // Subject eligibility (fail loud): the chosen owner must be allowed to own a goal.
    if (dto.owner_user_id) {
      await this.subjects.assertEligible(orgId, 'goals.subject.ownable', dto.owner_user_id);
    }

    const dueDate = this.parseDate(dto.due_date, 'due_date');
    const startDate = dto.start_date ? this.parseDate(dto.start_date, 'start_date') : null;

    let parentGoalId: string | null = null;
    let perspective: GoalPerspective | null = null;

    if (dto.level === 'objective') {
      if (dto.parent_goal_id) {
        throw new BadRequestException('An objective is a top-level goal and cannot have a parent.');
      }
      // perspective stays null — objectives have no perspective
    } else {
      if (!dto.parent_goal_id) {
        throw new BadRequestException(`A ${dto.level} goal must have a parent.`);
      }
      const parent = await this.findActiveOrFail(orgId, dto.parent_goal_id);
      const requiredParentLevel: GoalLevel = dto.level === 'annual' ? 'objective' : 'annual';
      if (parent.level !== requiredParentLevel) {
        throw new BadRequestException(
          `A ${dto.level} goal's parent must be a ${requiredParentLevel}.`,
        );
      }
      parentGoalId = parent.id;

      if (dto.level === 'annual') {
        if (!dto.perspective) {
          throw new BadRequestException('A goal must have a Balanced-Scorecard perspective.');
        }
        perspective = dto.perspective;
      } else {
        // quarterly — defaults to the parent goal's perspective but may be set to any other
        perspective = dto.perspective ?? parent.perspective;
      }

      this.assertWithinParentBounds(dueDate, parent.due_date, dto.level);
    }

    this.assertNotPast(dueDate);

    const goal = await this.prisma.goal.create({
      data: {
        organization_id: orgId,
        level: dto.level,
        parent_goal_id: parentGoalId,
        perspective,
        title: dto.title.trim(),
        description: dto.description ?? null,
        owner_user_id: dto.owner_user_id,
        department_id: dto.department_id ?? null,
        start_date: startDate,
        due_date: dueDate,
        status: dto.status ?? 'not_started',
        review_cadence: dto.review_cadence ?? 'none',
        next_review_date:
          dto.review_cadence && dto.review_cadence !== 'none'
            ? this.nextReviewDate(new Date(), dto.review_cadence)
            : null,
        created_by_user_id: userId,
        measures: dto.measures?.length
          ? {
              create: dto.measures.map((m) => ({
                organization_id: orgId,
                name: m.name.trim(),
                target_value: m.target_value,
                current_value: m.current_value ?? null,
                unit: m.unit ?? null,
              })),
            }
          : undefined,
      },
      include: { measures: true },
    });

    await this.audit.record({
      orgId,
      actorId: userId,
      action: 'create',
      resource: 'goal',
      entityId: goal.id,
      entityLabel: goal.title,
      changes: { level: { before: null, after: goal.level }, title: { before: null, after: goal.title } },
    });

    return goal;
  }

  // ─── List ─────────────────────────────────────────────────────────────────
  async list(orgId: string, principal: Principal, filters: GoalListFilters = {}) {
    const where: Prisma.GoalWhereInput = { organization_id: orgId, is_deleted: false };
    const scopeWhere = await this.goalsLineOfSightWhere(orgId, principal);
    if (Object.keys(scopeWhere).length) where.AND = [scopeWhere];
    if (filters.level) where.level = filters.level;
    if (filters.perspective) where.perspective = filters.perspective;
    if (filters.owner_user_id) where.owner_user_id = filters.owner_user_id;
    if (filters.parent_goal_id) where.parent_goal_id = filters.parent_goal_id;
    if (filters.status) where.status = filters.status as any;
    if (filters.from_date || filters.to_date) {
      where.due_date = {};
      if (filters.from_date) where.due_date.gte = new Date(filters.from_date);
      if (filters.to_date) where.due_date.lte = new Date(filters.to_date);
    }
    if (filters.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
    }

    return this.prisma.goal.findMany({
      where,
      orderBy: { due_date: 'asc' },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
        _count: { select: { children: { where: { is_deleted: false } }, measures: true } },
      },
    });
  }

  // ─── Detail (line of sight up + down + measures + linked tasks) ────────────
  async getOne(orgId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, organization_id: orgId, is_deleted: false },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
        measures: {
          orderBy: { created_at: 'asc' },
          include: { check_ins: { orderBy: { created_at: 'asc' } } },
        },
        check_ins: {
          take: 12,
          orderBy: { check_in_date: 'desc' },
          include: {
            created_by: { select: { id: true, name: true } },
            measure_values: true,
          },
        },
        parent: {
          include: { owner: { select: { id: true, name: true } } },
        },
        children: {
          where: { is_deleted: false },
          orderBy: { due_date: 'asc' },
          include: {
            owner: { select: { id: true, name: true } },
            _count: { select: { children: { where: { is_deleted: false } } } },
          },
        },
      },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    let tasks: any[] = [];
    if (goal.level === 'quarterly') {
      tasks = await this.prisma.task.findMany({
        where: { goal_id: id, organization_id: orgId, is_deleted: false },
        orderBy: { created_at: 'desc' },
        include: {
          status: true,
          priority: true,
          assignees: true,
        },
      });
    }

    return { ...goal, tasks };
  }

  // ─── Smart default date for the next sibling under a parent ────────────────
  async getNextDefault(orgId: string, parentId: string) {
    const parent = await this.findActiveOrFail(orgId, parentId);
    const childLevel: GoalLevel = parent.level === 'objective' ? 'annual' : 'quarterly';
    if (parent.level === 'quarterly') {
      throw new BadRequestException('Sub-goals cannot have child goals.');
    }

    const previous = await this.prisma.goal.findFirst({
      where: { organization_id: orgId, parent_goal_id: parentId, is_deleted: false },
      orderBy: { due_date: 'desc' },
    });

    const parentDue = parent.due_date;
    const minDate = this.startOfToday();

    if (!previous) {
      // First child: user picks freely within [today, parentDue]
      return {
        child_level: childLevel,
        is_first: true,
        suggested: null,
        clamped: false,
        min_date: this.toISODate(minDate),
        max_date: this.toISODate(parentDue),
        parent_due_date: parentDue,
        perspective: parent.perspective,
      };
    }

    const base = new Date(previous.due_date);
    if (childLevel === 'annual') {
      base.setFullYear(base.getFullYear() + 1);
    } else {
      base.setMonth(base.getMonth() + 3);
    }

    let suggested = base;
    let clamped = false;
    if (suggested > parentDue) {
      suggested = new Date(parentDue);
      clamped = true;
    }

    return {
      child_level: childLevel,
      is_first: false,
      suggested: this.toISODate(suggested),
      clamped,
      min_date: this.toISODate(minDate),
      max_date: this.toISODate(parentDue),
      parent_due_date: parentDue,
      perspective: parent.perspective,
    };
  }

  // ─── Balanced Scorecard rollup (annual goals only) ─────────────────────────
  async getScorecard(orgId: string) {
    const annuals = await this.prisma.goal.findMany({
      where: { organization_id: orgId, level: 'annual', is_deleted: false },
      select: { perspective: true, progress_percent: true },
    });

    return PERSPECTIVES.map((p) => {
      const inQuadrant = annuals.filter((g) => g.perspective === p);
      const count = inQuadrant.length;
      const avg = count
        ? Math.round(inQuadrant.reduce((s, g) => s + g.progress_percent, 0) / count)
        : 0;
      return { perspective: p, goal_count: count, average_progress: avg };
    });
  }

  // ─── Check-in (record actuals + confidence at a review event) ──────────────
  async createCheckIn(orgId: string, userId: string, goalId: string, dto: CreateGoalCheckInDto) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, organization_id: orgId, is_deleted: false },
      include: { measures: true },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    const checkInDate = this.parseDate(dto.check_in_date, 'check_in_date');

    // Only accept values that map to a measure actually on this goal.
    const measureIds = new Set(goal.measures.map((m) => m.id));
    const values = (dto.values ?? []).filter(
      (v) => measureIds.has(v.goal_measure_id) && v.value?.trim() !== '',
    );

    // Compute progress against the post-check-in measure snapshot.
    const merged = goal.measures.map((m) => {
      const v = values.find((x) => x.goal_measure_id === m.id);
      return { target_value: m.target_value, current_value: v ? v.value : m.current_value };
    });
    const computed = this.computeProgress(merged);
    const progress = computed ?? goal.progress_percent;

    const checkIn = await this.prisma.$transaction(async (tx) => {
      const ci = await tx.goalCheckIn.create({
        data: {
          organization_id: orgId,
          goal_id: goalId,
          check_in_date: checkInDate,
          confidence: dto.confidence,
          progress_percent: progress,
          status_note: dto.status_note?.trim() || null,
          created_by_user_id: userId,
          measure_values: values.length
            ? {
                create: values.map((v) => ({
                  organization_id: orgId,
                  goal_measure_id: v.goal_measure_id,
                  value: v.value.trim(),
                })),
              }
            : undefined,
        },
        include: {
          created_by: { select: { id: true, name: true } },
          measure_values: true,
        },
      });

      // Denormalise the latest actual onto each measure for at-a-glance reads.
      for (const v of values) {
        await tx.goalMeasure.update({
          where: { id: v.goal_measure_id },
          data: { current_value: v.value.trim() },
        });
      }

      await tx.goal.update({
        where: { id: goalId },
        data: {
          progress_percent: progress,
          last_check_in_at: new Date(),
          last_confidence: dto.confidence,
          status: this.statusFromConfidence(dto.confidence, goal.status),
          next_review_date: this.nextReviewDate(checkInDate, goal.review_cadence),
        },
      });

      return ci;
    });

    // Roll the new progress up the line of sight (parents with no own measures).
    await this.rollupAncestors(orgId, goal.parent_goal_id);

    await this.audit.record({
      orgId,
      actorId: userId,
      action: 'create',
      resource: 'goal_check_in',
      entityId: checkIn.id,
      entityLabel: goal.title,
      changes: {
        confidence: { before: null, after: dto.confidence },
        progress_percent: { before: goal.progress_percent, after: progress },
      },
    });

    return checkIn;
  }

  async listCheckIns(orgId: string, goalId: string) {
    await this.findActiveOrFail(orgId, goalId);
    return this.prisma.goalCheckIn.findMany({
      where: { goal_id: goalId, organization_id: orgId },
      orderBy: { check_in_date: 'desc' },
      include: {
        created_by: { select: { id: true, name: true } },
        measure_values: true,
      },
    });
  }

  // ─── Update ────────────────────────────────────────────────────────────────
  async update(orgId: string, userId: string, id: string, dto: UpdateGoalDto) {
    const existing = await this.findActiveOrFail(orgId, id);

    const data: Prisma.GoalUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.owner_user_id !== undefined) {
      if (dto.owner_user_id) {
        await this.subjects.assertEligible(orgId, 'goals.subject.ownable', dto.owner_user_id);
      }
      data.owner = { connect: { id: dto.owner_user_id } };
    }
    if (dto.department_id !== undefined) {
      data.department = dto.department_id
        ? { connect: { id: dto.department_id } }
        : { disconnect: true };
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.review_cadence !== undefined) {
      data.review_cadence = dto.review_cadence;
      // Re-anchor the next review off the last check-in (or now) under the new cadence.
      const base = existing.last_check_in_at ?? new Date();
      data.next_review_date =
        dto.review_cadence === 'none' ? null : this.nextReviewDate(base, dto.review_cadence);
    }
    if (dto.start_date !== undefined) {
      data.start_date = dto.start_date ? this.parseDate(dto.start_date, 'start_date') : null;
    }
    if (dto.due_date !== undefined) {
      const due = this.parseDate(dto.due_date, 'due_date');
      this.assertNotPast(due);
      if (existing.parent_goal_id) {
        const parent = await this.findActiveOrFail(orgId, existing.parent_goal_id);
        this.assertWithinParentBounds(due, parent.due_date, existing.level);
      }
      // moving a parent's due date in must still cover its children
      await this.assertCoversChildren(orgId, id, due);
      data.due_date = due;
    }

    const updated = await this.prisma.goal.update({ where: { id }, data });

    if (dto.measures !== undefined) {
      // Upsert by id so a measure keeps its identity — and its check-in history —
      // across edits. (A blanket delete/recreate would cascade-delete every
      // MeasureCheckIn tied to it.) current_value is owned by check-ins, so it is
      // never touched here; only measures the user actually removed are deleted.
      const existingMeasures = await this.prisma.goalMeasure.findMany({
        where: { goal_id: id },
        select: { id: true },
      });
      const existingIds = new Set(existingMeasures.map((m) => m.id));
      const keptIds = new Set(dto.measures.filter((m) => m.id).map((m) => m.id as string));

      const toDelete = [...existingIds].filter((eid) => !keptIds.has(eid));
      if (toDelete.length) {
        await this.prisma.goalMeasure.deleteMany({ where: { id: { in: toDelete } } });
      }

      for (const m of dto.measures) {
        if (m.id && existingIds.has(m.id)) {
          await this.prisma.goalMeasure.update({
            where: { id: m.id },
            data: { name: m.name.trim(), target_value: m.target_value, unit: m.unit ?? null },
          });
        } else {
          await this.prisma.goalMeasure.create({
            data: {
              organization_id: orgId,
              goal_id: id,
              name: m.name.trim(),
              target_value: m.target_value,
              current_value: m.current_value ?? null,
              unit: m.unit ?? null,
            },
          });
        }
      }

      // A measure set change can shift computed progress — recompute from measures.
      await this.recomputeProgressFromMeasures(orgId, id);
    }

    const changes = this.audit.diff(
      existing,
      {
        title: dto.title?.trim(),
        description: dto.description,
        owner_user_id: dto.owner_user_id,
        department_id: dto.department_id,
        status: dto.status,
        start_date: data.start_date as Date | null | undefined,
        due_date: data.due_date as Date | undefined,
      } as any,
      ['title', 'description', 'owner_user_id', 'department_id', 'status', 'start_date', 'due_date'],
    );
    if (changes) {
      await this.audit.record({
        orgId,
        actorId: userId,
        action: 'update',
        resource: 'goal',
        entityId: id,
        entityLabel: updated.title,
        changes,
      });
    }

    return this.getOne(orgId, id);
  }

  // ─── Soft delete (blocked when children exist) ─────────────────────────────
  async remove(orgId: string, userId: string, id: string, reason?: string) {
    const existing = await this.findActiveOrFail(orgId, id);

    const childCount = await this.prisma.goal.count({
      where: { parent_goal_id: id, is_deleted: false },
    });
    if (childCount > 0) {
      throw new ConflictException(
        existing.level === 'objective'
          ? 'This objective still has goals. Reassign or remove them first.'
          : 'This goal still has sub-goals. Reassign or remove them first.',
      );
    }

    await this.prisma.goal.update({
      where: { id },
      data: {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by_user_id: userId,
        deletion_reason: reason ?? null,
      },
    });

    await this.audit.record({
      orgId,
      actorId: userId,
      action: 'delete',
      resource: 'goal',
      entityId: id,
      entityLabel: existing.title,
      changes: reason ? { deletion_reason: { before: null, after: reason } } : null,
    });

    return { success: true };
  }

  // ─── Line-of-sight visibility ──────────────────────────────────────────────

  /**
   * Goal visibility follows the cascade, not just row ownership. A user sees goals
   * they participate in (own/created, within their data scope) PLUS the entire
   * sub-tree beneath them AND the parent chain above them — so owning an objective
   * reveals the goals cascading under it, and owning a sub-goal reveals the objective
   * it rolls up to. Returns the Prisma `where` to AND into the list query
   * (`{}` = org-wide, `{ id: { in: [] } }` = nothing).
   */
  private async goalsLineOfSightWhere(
    orgId: string,
    principal: Principal,
  ): Promise<Prisma.GoalWhereInput> {
    const { effective } = await this.scope.resolveListScope(
      orgId,
      principal,
      GoalsService.GOALS_LEAF,
    );
    if (effective === null) return { id: { in: [] } }; // denied — fail closed
    if (effective === DataScope.org) return {}; // no row restriction

    const visible = await this.scope.visibleUserIds(orgId, principal.userId, effective);
    if (visible === 'ALL') return {};

    // Seeds: goals anyone in the user's scope participates in (owns / created).
    const seeds = await this.prisma.goal.findMany({
      where: {
        organization_id: orgId,
        is_deleted: false,
        OR: [{ owner_user_id: { in: visible } }, { created_by_user_id: { in: visible } }],
      },
      select: { id: true, parent_goal_id: true },
    });

    const visibleIds = new Set<string>(seeds.map((s) => s.id));

    // Walk UP — the parent chain of every seed (line of sight to the top).
    let parentIds = seeds.map((s) => s.parent_goal_id).filter((p): p is string => !!p);
    while (parentIds.length) {
      const parents = await this.prisma.goal.findMany({
        where: { id: { in: parentIds }, organization_id: orgId, is_deleted: false },
        select: { id: true, parent_goal_id: true },
      });
      parentIds = [];
      for (const p of parents) {
        if (!visibleIds.has(p.id)) {
          visibleIds.add(p.id);
          if (p.parent_goal_id) parentIds.push(p.parent_goal_id);
        }
      }
    }

    // Walk DOWN — the whole sub-tree beneath every seed.
    let frontier = seeds.map((s) => s.id);
    while (frontier.length) {
      const children = await this.prisma.goal.findMany({
        where: { parent_goal_id: { in: frontier }, organization_id: orgId, is_deleted: false },
        select: { id: true },
      });
      frontier = [];
      for (const c of children) {
        if (!visibleIds.has(c.id)) {
          visibleIds.add(c.id);
          frontier.push(c.id);
        }
      }
    }

    return { id: { in: [...visibleIds] } };
  }

  // ─── Progress / rollup ─────────────────────────────────────────────────────

  /** Average of each numeric measure's clamped (current ÷ target) %. Null when
   *  no measure is numerically computable (leave progress to roll up / manual). */
  private computeProgress(
    measures: { target_value: string; current_value: string | null }[],
  ): number | null {
    const pcts: number[] = [];
    for (const m of measures) {
      const target = this.toNum(m.target_value);
      const current = this.toNum(m.current_value);
      if (target === null || current === null || target === 0) continue;
      pcts.push(Math.max(0, Math.min(100, (current / target) * 100)));
    }
    if (!pcts.length) return null;
    return Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length);
  }

  private toNum(v: string | null | undefined): number | null {
    if (v === null || v === undefined) return null;
    const n = parseFloat(String(v).replace(/[, ]/g, ''));
    return isNaN(n) ? null : n;
  }

  /** Recompute a goal's progress from its current measures, then roll up. */
  private async recomputeProgressFromMeasures(orgId: string, goalId: string) {
    const measures = await this.prisma.goalMeasure.findMany({
      where: { goal_id: goalId },
      select: { target_value: true, current_value: true },
    });
    const computed = this.computeProgress(measures);
    if (computed !== null) {
      await this.prisma.goal.update({
        where: { id: goalId },
        data: { progress_percent: computed },
      });
    }
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      select: { parent_goal_id: true },
    });
    await this.rollupAncestors(orgId, goal?.parent_goal_id ?? null);
  }

  /** Walk up the line of sight: a parent with no measures of its own takes the
   *  average progress of its children. A parent that has its own measures owns
   *  its progress via its own check-ins, so propagation stops there. */
  private async rollupAncestors(orgId: string, parentId: string | null) {
    let current = parentId;
    const guard = new Set<string>();
    while (current && !guard.has(current)) {
      guard.add(current);
      const parent = await this.prisma.goal.findFirst({
        where: { id: current, organization_id: orgId, is_deleted: false },
        include: { _count: { select: { measures: true } } },
      });
      if (!parent) break;
      if (parent._count.measures > 0) break;

      const children = await this.prisma.goal.findMany({
        where: { parent_goal_id: current, is_deleted: false },
        select: { progress_percent: true },
      });
      const avg = children.length
        ? Math.round(children.reduce((s, c) => s + c.progress_percent, 0) / children.length)
        : 0;
      await this.prisma.goal.update({ where: { id: current }, data: { progress_percent: avg } });
      current = parent.parent_goal_id;
    }
  }

  private nextReviewDate(from: Date, cadence: GoalCadence): Date | null {
    const d = new Date(from);
    switch (cadence) {
      case 'weekly':
        d.setDate(d.getDate() + 7);
        return d;
      case 'biweekly':
        d.setDate(d.getDate() + 14);
        return d;
      case 'monthly':
        d.setMonth(d.getMonth() + 1);
        return d;
      case 'quarterly':
        d.setMonth(d.getMonth() + 3);
        return d;
      default:
        return null;
    }
  }

  /** Map the owner's RAG confidence onto the goal's status, without clobbering a
   *  goal that's already been closed out (achieved/archived). */
  private statusFromConfidence(c: GoalConfidence, currentStatus: GoalStatus): GoalStatus {
    if (currentStatus === 'achieved' || currentStatus === 'archived') return currentStatus;
    return c === 'on_track' ? 'on_track' : 'at_risk';
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  private async findActiveOrFail(orgId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, organization_id: orgId, is_deleted: false },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }

  private async assertCoversChildren(orgId: string, parentId: string, newDue: Date) {
    const latestChild = await this.prisma.goal.findFirst({
      where: { parent_goal_id: parentId, is_deleted: false },
      orderBy: { due_date: 'desc' },
      select: { due_date: true },
    });
    if (latestChild && latestChild.due_date > this.endOfDay(newDue)) {
      throw new BadRequestException(
        'Due date cannot be earlier than the due date of a child goal.',
      );
    }
  }

  private assertWithinParentBounds(due: Date, parentDue: Date, level: GoalLevel) {
    if (this.startOfDay(due) > this.endOfDay(parentDue)) {
      const parentName = level === 'annual' ? 'objective' : 'annual';
      throw new BadRequestException(
        `A ${level} goal's due date cannot be later than its parent ${parentName}'s due date (${this.toISODate(parentDue)}).`,
      );
    }
  }

  private assertNotPast(due: Date) {
    if (this.endOfDay(due) < this.startOfToday()) {
      throw new BadRequestException('Due date cannot be in the past.');
    }
  }

  private parseDate(value: string, field: string): Date {
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new BadRequestException(`Invalid ${field}.`);
    return d;
  }

  private startOfToday(): Date {
    return this.startOfDay(new Date());
  }
  private startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  private endOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }
  private toISODate(d: Date): string {
    return this.startOfDay(d).toISOString().slice(0, 10);
  }
}
