import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GoalLevel, GoalPerspective, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────
  async create(orgId: string, userId: string, dto: CreateGoalDto) {
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
          throw new BadRequestException('An annual goal must have a Balanced-Scorecard perspective.');
        }
        perspective = dto.perspective;
      } else {
        // quarterly — perspective is inherited from the parent annual, never re-picked
        perspective = parent.perspective;
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
  async list(orgId: string, filters: GoalListFilters = {}) {
    const where: Prisma.GoalWhereInput = { organization_id: orgId, is_deleted: false };
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
        measures: { orderBy: { created_at: 'asc' } },
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
      throw new BadRequestException('Quarterly goals cannot have child goals.');
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

  // ─── Update ────────────────────────────────────────────────────────────────
  async update(orgId: string, userId: string, id: string, dto: UpdateGoalDto) {
    const existing = await this.findActiveOrFail(orgId, id);

    const data: Prisma.GoalUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.owner_user_id !== undefined) {
      data.owner = { connect: { id: dto.owner_user_id } };
    }
    if (dto.department_id !== undefined) {
      data.department = dto.department_id
        ? { connect: { id: dto.department_id } }
        : { disconnect: true };
    }
    if (dto.status !== undefined) data.status = dto.status;
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
      await this.prisma.goalMeasure.deleteMany({ where: { goal_id: id } });
      if (dto.measures.length) {
        await this.prisma.goalMeasure.createMany({
          data: dto.measures.map((m) => ({
            organization_id: orgId,
            goal_id: id,
            name: m.name.trim(),
            target_value: m.target_value,
            current_value: m.current_value ?? null,
            unit: m.unit ?? null,
          })),
        });
      }
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
          ? 'This objective still has annual goals. Reassign or remove them first.'
          : 'This annual goal still has quarterly goals. Reassign or remove them first.',
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
