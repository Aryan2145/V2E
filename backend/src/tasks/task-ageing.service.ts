import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../access-rights/scope.service';
import { Principal } from '../access-rights/permissions.service';
import { ClockService } from '../clock/clock.service';
import { isSuccessful, isTerminal } from './status-phase';

/**
 * Pending & Overdue Ageing report — models the client's "Pending and Overdue
 * Ageing Report" (three linked sheets: Person-wise, Task-wise, Pending Task List).
 *
 * It looks ONLY at work that is still open — Overdue or Ongoing. Completed and
 * terminally-closed tasks are out. Every open task ENTRY (each recurring
 * occurrence + each one-time task, per assignee) is aged by how many days late it
 * is against the "position as on" date (the org's current / simulated clock):
 *
 *   Days Late = As-On date − Due date  (whole days, both taken as calendar dates)
 *
 * and dropped into one age band. "Not Yet Due" work (due date still ahead, or no
 * due date) is kept in its own band so nobody is blamed for work that isn't late
 * yet, and it is kept OUT of the oldest / average-late figures.
 *
 * Strictly scope-aware: reuses the same visibility model as the rest of Work — a
 * viewer only ever sees people inside their effective scope (own/team/dept/org).
 */

const TASK_LEAF = 'tasks.task.manage';
const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_CAP = 80000;
/**
 * Detail rows returned to the browser for the Pending List + click-through drills.
 * Set high on purpose: every count on the grid is clickable and must land on
 * EXACTLY that many rows, so the list has to carry the whole pending set (both are
 * built in one pass off one clock read). `list_truncated` flags the rare overflow.
 */
const LIST_CAP = 20000;

export type AgeBucketKey =
  | 'not_yet_due'
  | 'd1_7'
  | 'd8_15'
  | 'd16_30'
  | 'd31_60'
  | 'd61_90'
  | 'd90_plus';

/** Human label per band — shared verbatim by the "How Late" column + the Excel. */
export const AGE_BUCKET_LABEL: Record<AgeBucketKey, string> = {
  not_yet_due: 'Not Yet Due',
  d1_7: '1 to 7 Days Late',
  d8_15: '8 to 15 Days Late',
  d16_30: '16 to 30 Days Late',
  d31_60: '31 to 60 Days Late',
  d61_90: '61 to 90 Days Late',
  d90_plus: 'More than 90 Days Late',
};

/** The seven age bands + the three derived figures — one shared block per row. */
export interface AgeBuckets {
  not_yet_due: number;
  d1_7: number;
  d8_15: number;
  d16_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  total_pending: number; // every open entry, incl. Not Yet Due
  over_month_late: number; // d31_60 + d61_90 + d90_plus — everything above 30 days
  oldest_late_days: number | null; // age of the single oldest LATE entry (Not Yet Due excluded)
  avg_late_days: number | null; // mean age over LATE entries only (Not Yet Due excluded)
}

export interface PersonAgeRow extends AgeBuckets {
  user_id: string;
  name: string;
  role_title: string | null;
  department_name: string | null;
}

export interface TaskAgeRow extends AgeBuckets {
  title: string;
  frequency: string;
}

/** One open task entry — the Pending Task List sheet + the in-app detail table. */
export interface PendingTaskRow {
  task_id: string;
  title: string;
  assigned_to: string;
  assigned_to_user_id: string;
  assigned_by: string | null;
  department: string | null;
  frequency: string;
  due_date: string | null;
  days_late: number | null; // null when Not Yet Due (or no due date)
  bucket: AgeBucketKey;
  bucket_label: string; // AGE_BUCKET_LABEL[bucket]
  status: 'Overdue' | 'Not Yet Due';
}

export interface AgeingReport {
  as_on_date: string;
  people: PersonAgeRow[];
  tasks: TaskAgeRow[];
  pending: PendingTaskRow[];
  totals: AgeBuckets; // identical for the Person-wise and Task-wise Overall rows
  frequencies: string[]; // distinct frequency labels present (for the filter dropdown)
  list_truncated: boolean; // pending[] was capped for transport (aggregates still complete)
  applied_scope: DataScope | null;
  max_scope: DataScope | null;
}

export interface AgeingFilters {
  scope?: DataScope | null;
}

// Mutable per-group age accumulator.
interface AgeAcc {
  not_yet_due: number;
  d1_7: number;
  d8_15: number;
  d16_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  lateSum: number; // Σ days_late over LATE entries
  lateCount: number;
  oldest: number | null;
}

function newAcc(): AgeAcc {
  return { not_yet_due: 0, d1_7: 0, d8_15: 0, d16_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, lateSum: 0, lateCount: 0, oldest: null };
}

/** Whole calendar days between two dates (both floored to midnight; DST-safe). */
function dayDiff(now: Date, due: Date): number {
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(due); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

/** Age band for a signed days-late figure (≤ 0 ⇒ not yet due / due today). */
function bucketOf(daysLate: number): AgeBucketKey {
  if (daysLate <= 0) return 'not_yet_due';
  if (daysLate <= 7) return 'd1_7';
  if (daysLate <= 15) return 'd8_15';
  if (daysLate <= 30) return 'd16_30';
  if (daysLate <= 60) return 'd31_60';
  if (daysLate <= 90) return 'd61_90';
  return 'd90_plus';
}

function addToAcc(acc: AgeAcc, bucket: AgeBucketKey, daysLate: number | null) {
  acc[bucket] += 1;
  if (bucket !== 'not_yet_due' && daysLate !== null) {
    acc.lateSum += daysLate;
    acc.lateCount += 1;
    if (acc.oldest === null || daysLate > acc.oldest) acc.oldest = daysLate;
  }
}

function finalizeAcc(acc: AgeAcc): AgeBuckets {
  const total = acc.not_yet_due + acc.d1_7 + acc.d8_15 + acc.d16_30 + acc.d31_60 + acc.d61_90 + acc.d90_plus;
  return {
    not_yet_due: acc.not_yet_due,
    d1_7: acc.d1_7,
    d8_15: acc.d8_15,
    d16_30: acc.d16_30,
    d31_60: acc.d31_60,
    d61_90: acc.d61_90,
    d90_plus: acc.d90_plus,
    total_pending: total,
    over_month_late: acc.d31_60 + acc.d61_90 + acc.d90_plus,
    oldest_late_days: acc.oldest,
    avg_late_days: acc.lateCount > 0 ? Math.round((acc.lateSum / acc.lateCount) * 100) / 100 : null,
  };
}

@Injectable()
export class TaskAgeingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly clock: ClockService,
  ) {}

  /** Build the full ageing report for everyone in the viewer's effective scope. */
  async getReport(orgId: string, principal: Principal, filters: AgeingFilters): Promise<AgeingReport> {
    const { max, effective } = await this.scope.resolveListScope(orgId, principal, TASK_LEAF, filters.scope ?? null);
    if (effective === null) {
      return {
        as_on_date: (await this.clock.now(orgId)).toISOString(),
        people: [], tasks: [], pending: [], totals: finalizeAcc(newAcc()),
        frequencies: [], list_truncated: false, applied_scope: null, max_scope: max,
      };
    }

    const visible = await this.scope.visibleUserIds(orgId, principal.userId, effective);
    const now = await this.clock.now(orgId);

    // People in scope (name / role / department).
    const profiles = await this.prisma.employeeProfile.findMany({
      where: { organization_id: orgId, ...(visible === 'ALL' ? {} : { user_id: { in: visible } }) },
      select: {
        user_id: true,
        user: { select: { id: true, name: true } },
        role: { select: { title: true } },
        department: { select: { name: true } },
      },
    });
    const person = new Map(
      profiles
        .filter((p) => p.user)
        .map((p) => [p.user_id, { name: p.user!.name, role_title: p.role?.title ?? null, department_name: p.department?.name ?? null }]),
    );
    const idSet = new Set(person.keys());
    if (idSet.size === 0) {
      return {
        as_on_date: now.toISOString(), people: [], tasks: [], pending: [], totals: finalizeAcc(newAcc()),
        frequencies: [], list_truncated: false, applied_scope: effective, max_scope: max,
      };
    }
    const assigneeUserFilter = visible === 'ALL' ? undefined : { in: Array.from(idSet) };

    // Frequency label per recurring template (one-time tasks are labelled "One-time").
    const freqByTemplate = await this.frequencyMap(orgId);

    // One pass over every task assigned to the in-scope set (one-time + occurrences).
    const tasks = await this.prisma.task.findMany({
      where: {
        organization_id: orgId,
        is_deleted: false,
        assignees: { some: { is_cc: false, ...(assigneeUserFilter ? { user_id: assigneeUserFilter } : {}) } },
      },
      select: {
        id: true,
        title: true,
        recurring_template_id: true,
        created_by_user_id: true,
        deadline: true,
        completion_mode: true,
        status: { select: { type: true } },
        assignees: { where: { is_cc: false }, select: { user_id: true, is_completed: true } },
      },
      take: ROW_CAP,
    });

    // Assigner names.
    const creatorIds = Array.from(new Set(tasks.map((t) => t.created_by_user_id).filter(Boolean))) as string[];
    const creators = creatorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } })
      : [];
    const creatorName = new Map(creators.map((c) => [c.id, c.name]));

    const byPerson = new Map<string, AgeAcc>();
    const byTask = new Map<string, { frequency: string; acc: AgeAcc }>();
    const totalAcc = newAcc();
    const freqSet = new Set<string>();
    const pending: PendingTaskRow[] = [];

    for (const t of tasks) {
      const frequency = t.recurring_template_id ? (freqByTemplate.get(t.recurring_template_id) ?? 'Recurring') : 'One-time';
      const deadline = t.deadline ?? null;
      const anyCan = t.completion_mode !== 'all_must_complete';

      for (const a of t.assignees) {
        if (!idSet.has(a.user_id)) continue;

        // Only OPEN work counts — completed or terminally-closed entries are out.
        const completed = anyCan ? isSuccessful(t.status?.type) : a.is_completed;
        if (completed) continue;
        if (isTerminal(t.status?.type)) continue;

        // Age it. No due date ⇒ can't be late ⇒ Not Yet Due band.
        const daysLate = deadline ? dayDiff(now, deadline) : -1;
        const bucket = bucketOf(daysLate);
        const late = bucket !== 'not_yet_due';
        const daysLateOut = late ? daysLate : null;

        const pacc = byPerson.get(a.user_id) ?? newAcc();
        addToAcc(pacc, bucket, daysLateOut);
        byPerson.set(a.user_id, pacc);

        let tacc = byTask.get(t.title);
        if (!tacc) { tacc = { frequency, acc: newAcc() }; byTask.set(t.title, tacc); }
        addToAcc(tacc.acc, bucket, daysLateOut);

        addToAcc(totalAcc, bucket, daysLateOut);
        freqSet.add(frequency);

        const p = person.get(a.user_id)!;
        pending.push({
          task_id: t.id,
          title: t.title,
          assigned_to: p.name,
          assigned_to_user_id: a.user_id,
          assigned_by: t.created_by_user_id ? creatorName.get(t.created_by_user_id) ?? null : null,
          department: p.department_name,
          frequency,
          due_date: deadline ? deadline.toISOString() : null,
          days_late: daysLateOut,
          bucket,
          bucket_label: AGE_BUCKET_LABEL[bucket],
          status: late ? 'Overdue' : 'Not Yet Due',
        });
      }
    }

    // Person-wise rows — sorted by the heaviest pile first.
    const people: PersonAgeRow[] = Array.from(byPerson.entries())
      .map(([uid, acc]) => {
        const p = person.get(uid)!;
        return { user_id: uid, name: p.name, role_title: p.role_title, department_name: p.department_name, ...finalizeAcc(acc) };
      })
      .sort((a, b) => b.total_pending - a.total_pending || a.name.localeCompare(b.name));

    // Task-wise rows — heaviest pile first.
    const taskRows: TaskAgeRow[] = Array.from(byTask.entries())
      .map(([title, { frequency, acc }]) => ({ title, frequency, ...finalizeAcc(acc) }))
      .sort((a, b) => b.total_pending - a.total_pending || a.title.localeCompare(b.title));

    // Pending list — oldest late work first (Not Yet Due sinks to the bottom).
    pending.sort((a, b) => (b.days_late ?? -1) - (a.days_late ?? -1) || a.assigned_to.localeCompare(b.assigned_to));
    const list_truncated = pending.length > LIST_CAP;

    return {
      as_on_date: now.toISOString(),
      people,
      tasks: taskRows,
      pending: list_truncated ? pending.slice(0, LIST_CAP) : pending,
      totals: finalizeAcc(totalAcc),
      frequencies: Array.from(freqSet).sort(),
      list_truncated,
      applied_scope: effective,
      max_scope: max,
    };
  }

  /** Short frequency word per template: Daily / Weekly / Monthly / Yearly / Custom. */
  private async frequencyMap(orgId: string): Promise<Map<string, string>> {
    const templates = await this.prisma.recurringTemplate.findMany({
      where: { organization_id: orgId },
      select: { id: true, schedule_entries: { select: { schedule_type: true } } },
    });
    return new Map(templates.map((t) => [t.id, this.frequencyLabel(t.schedule_entries)]));
  }

  private frequencyLabel(entries: { schedule_type: string }[]): string {
    if (!entries?.length) return 'Recurring';
    const types = new Set(entries.map((e) => e.schedule_type));
    if (types.size > 1) return 'Custom';
    const t = entries[0].schedule_type;
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Recurring';
  }
}
