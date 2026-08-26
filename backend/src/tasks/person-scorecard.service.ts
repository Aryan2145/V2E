import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../access-rights/scope.service';
import { Principal } from '../access-rights/permissions.service';
import { ClockService } from '../clock/clock.service';
import { isSuccessful, isTerminal } from './status-phase';
import { shouldEntryFireToday, type RecurrenceEntry } from '../common/recurrence/should-fire-today';

/**
 * Person Scorecard — a per-person view of workload + discipline, modelled on the
 * client's "Person Wise Task Scorecard" export:
 *   • headline metrics count every task ENTRY (each recurring occurrence + each
 *     one-time task), per person: given / completed / overdue / ongoing / on-time /
 *     late + delay stats. On-Time % (on-time ÷ given) is the real score.
 *   • a Task Data list: one row per entry (title, frequency, dept, assigner, due,
 *     completion, status, delay, on-time) — the export's detail sheet.
 *   • a "unique tasks held" view: recurring templates with cadence + next run.
 *
 * Strictly scope-aware and reuses the SAME visibility model as the rest of Work: a
 * viewer only ever sees people inside their effective scope (own/team/dept/org).
 */

const TASK_LEAF = 'tasks.task.manage';

type Timing = 'early' | 'on_time' | 'late' | 'partial' | 'incomplete' | 'overdue' | 'pending';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_CAP = 80000;

export interface ScorecardFilters {
  from_date?: string;
  to_date?: string;
  scope?: DataScope | null;
}

export interface ScorecardPerson {
  user_id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  department_name: string | null;
}

/**
 * The client's "Person Wise Task Compliance Scorecard" grade. Assigned in strict
 * order, first match wins (see `gradeOf`): < 25 entries can't be judged; otherwise
 * the On-Time Rate decides, with a "Late but Closing" rescue for people who close
 * almost everything but always run late.
 */
export type ScorecardGrade =
  | 'Very Good'
  | 'Good'
  | 'Average'
  | 'Late but Closing'
  | 'Needs Attention'
  | 'Too Few Tasks to Judge';

/**
 * The client's discipline metric set, per person. Column-for-column with the
 * "Person Wise Task Compliance Scorecard" sheet:
 *   different_tasks        → Different Tasks Handled (distinct task NAMES = real scope)
 *   total_given            → Total Task Entries (every occurrence + every one-time)
 *   avg_repeat             → Average Times Each Task Repeats (total ÷ different)
 *   completed / pending    → Tasks Completed / Tasks Still Pending (overdue + ongoing)
 *   completion_pct         → Completion Rate (completed ÷ total)
 *   completed_on_time      → Finished On or Before Due Date
 *   on_time_pct            → On Time Rate (on-time ÷ completed-with-a-date; pending kept out)
 *   avg_delay_days         → Average Delay in Days (mean signed delay; minus = early)
 *   longest_delay_days     → Longest Delay in Days
 *   grade                  → Grade
 */
export interface ScorecardMetrics {
  different_tasks: number;      // distinct task NAMES handled — the person's real scope
  recurring_unique: number;     // distinct active recurring templates held (detail view)
  total_given: number;          // every task ENTRY (each occurrence + each one-time)
  avg_repeat: number | null;    // total_given ÷ different_tasks
  completed: number;
  pending: number;              // overdue + ongoing (Tasks Still Pending)
  overdue: number;
  ongoing: number;
  completion_pct: number | null;   // completed ÷ total_given (0–100)
  completed_on_time: number;       // completed with delay ≤ 0
  completed_with_date: number;     // completed entries that carry a completion date + due (on-time denominator)
  completed_no_date: number;       // completed but no completion date entered — a data-entry gap, not a work gap
  on_time_pct: number | null;      // completed_on_time ÷ completed_with_date (0–100)
  avg_delay_days: number | null;   // COMPLETED work only: mean signed delay over completed_with_date (minus = early)
  longest_delay_days: number | null;         // COMPLETED work only: worst single delay
  avg_pending_age_days: number | null;       // PENDING work only: mean (today − due) over overdue tasks
  longest_pending_age_days: number | null;   // PENDING work only: oldest overdue task
  grade: ScorecardGrade;
}

/** Overall / Total row — same numbers, no grade and no per-person template count. */
export type ScorecardTotals = Omit<ScorecardMetrics, 'grade' | 'recurring_unique'>;

/**
 * Where a task stands *today*, from the dates — independent of the work stage.
 * A task past its due date and not finished is 'overdue' no matter what stage the
 * person left it in.
 */
export type EntryDateStatus = 'completed' | 'overdue' | 'in_progress' | 'not_yet_due' | 'closed';

/** One row per task entry — the "Task Data" detail sheet + the person detail list. */
export interface TaskEntryRow {
  task_id: string;
  title: string;
  frequency: string;
  department: string | null;
  assigned_by: string | null;
  due_date: string | null;
  completion_date: string | null;
  status: string | null;              // the work stage label (what the person did)
  date_status: EntryDateStatus;       // where it stands today (from the dates)
  delay_days: number | null;          // completed only: signed (completion − due); minus = early
  days_late: number | null;           // completed → signed delay; overdue → today − due (positive); else null
  on_time: 'Yes' | 'No' | '';
}

/** Supporting "unique recurring tasks held" row. */
export interface RecurringRow {
  template_id: string;
  title: string;
  cadence_label: string;
  frequency: string;
  start_date: string | null;
  end_date: string | null;
  next_run: string | null;
  fired: number;
  done: number;
  on_time_rate: number | null;
  last_completed_at: string | null;
  freshness_state: 'current' | 'behind' | 'none';
  freshness_label: string;
}

export interface Scorecard {
  employee: ScorecardPerson;
  metrics: ScorecardMetrics;
  recurring_tasks: RecurringRow[];
  entries: TaskEntryRow[];
}

export interface RosterItem extends ScorecardPerson, ScorecardMetrics {}

interface ComputeOpts {
  includeDetail: boolean; // build entries[] + recurring_tasks[] (detail/export); roster skips.
}

// Mutable per-person accumulator used during the fold.
interface Acc {
  employee: ScorecardPerson;
  titles: Set<string>;       // distinct task names → Different Tasks Handled
  total: number;
  completed: number;
  overdue: number;
  ongoing: number;
  onTime: number;            // completed with delay ≤ 0
  completedWithDate: number; // completed entries that carry both a completion date and a due date
  noDate: number;            // completed but no completion date entered
  delaySum: number;          // Σ signed delay over completedWithDate (minus = early)
  delayMax: number | null;   // worst (max) signed delay, or null if none
  pendingAgeSum: number;     // Σ (today − due) over overdue tasks
  pendingAgeMax: number | null; // oldest overdue task, or null if none
  entries: TaskEntryRow[];
}

/** Raw counts needed to finalize a metric block (per-person or the overall total). */
interface RawCounts {
  different: number;
  total: number;
  completed: number;
  overdue: number;
  ongoing: number;
  onTime: number;
  completedWithDate: number;
  noDate: number;
  delaySum: number;
  delayMax: number | null;
  pendingAgeSum: number;
  pendingAgeMax: number | null;
}

/** The client's grade ladder — strict order, first match wins. */
function gradeOf(total: number, onRate: number, completionRate: number): ScorecardGrade {
  if (total < 25) return 'Too Few Tasks to Judge';
  if (onRate >= 0.6) return 'Very Good';
  if (onRate >= 0.3) return 'Good';
  if (onRate >= 0.15) return 'Average';
  if (completionRate >= 0.9) return 'Late but Closing';
  return 'Needs Attention';
}

/** Turn raw counts into the display metric block (percentages, averages, grade). */
function finalize(r: RawCounts): ScorecardMetrics {
  const onRate = r.completedWithDate > 0 ? r.onTime / r.completedWithDate : 0;
  const completionRate = r.total > 0 ? r.completed / r.total : 0;
  return {
    different_tasks: r.different,
    recurring_unique: 0, // filled in by the caller (kept out of the raw fold)
    total_given: r.total,
    avg_repeat: r.different > 0 ? Math.round((r.total / r.different) * 100) / 100 : null,
    completed: r.completed,
    pending: r.overdue + r.ongoing,
    overdue: r.overdue,
    ongoing: r.ongoing,
    completion_pct: r.total > 0 ? Math.round(completionRate * 100) : null,
    completed_on_time: r.onTime,
    completed_with_date: r.completedWithDate,
    completed_no_date: r.noDate,
    on_time_pct: r.completedWithDate > 0 ? Math.round(onRate * 100) : null,
    avg_delay_days: r.completedWithDate > 0 ? Math.round((r.delaySum / r.completedWithDate) * 100) / 100 : null,
    longest_delay_days: r.delayMax,
    avg_pending_age_days: r.overdue > 0 ? Math.round((r.pendingAgeSum / r.overdue) * 100) / 100 : null,
    longest_pending_age_days: r.pendingAgeMax,
    grade: gradeOf(r.total, onRate, completionRate),
  };
}

@Injectable()
export class PersonScorecardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly clock: ClockService,
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────────

  /** Scope-aware roster: the client's metric set per person the viewer may open. */
  async getRoster(orgId: string, principal: Principal, requested?: DataScope | null) {
    const { max, effective } = await this.scope.resolveListScope(orgId, principal, TASK_LEAF, requested ?? null);
    if (effective === null) return { people: [] as RosterItem[], applied_scope: null, max_scope: max };

    const visible = await this.scope.visibleUserIds(orgId, principal.userId, effective);
    const now = await this.clock.now(orgId);
    const cards = await this.compute(orgId, visible, {}, now, { includeDetail: false });

    const people: RosterItem[] = Array.from(cards.values())
      .map((c) => ({ ...c.employee, ...c.metrics }))
      .sort((a, b) => b.total_given - a.total_given || a.name.localeCompare(b.name));

    return { people, totals: this.totalsOf(cards.values()), applied_scope: effective, max_scope: max };
  }

  /** One person's full scorecard — gated: 403 if outside the viewer's scope. */
  async getScorecard(orgId: string, principal: Principal, targetUserId: string, filters: ScorecardFilters): Promise<Scorecard> {
    const { effective } = await this.scope.resolveListScope(orgId, principal, TASK_LEAF, undefined);
    if (effective === null) throw new ForbiddenException('You do not have access to task data');
    const visible = await this.scope.visibleUserIds(orgId, principal.userId, effective);
    if (visible !== 'ALL' && !visible.includes(targetUserId)) {
      throw new ForbiddenException('This employee is outside your visibility scope');
    }

    const now = await this.clock.now(orgId);
    const cards = await this.compute(orgId, [targetUserId], filters, now, { includeDetail: true });
    const card = cards.get(targetUserId);
    if (!card) throw new NotFoundException('Employee not found');
    return card;
  }

  /** Every in-scope person's full scorecard — powers "download everyone". */
  async getAllScorecards(orgId: string, principal: Principal, filters: ScorecardFilters) {
    const { max, effective } = await this.scope.resolveListScope(orgId, principal, TASK_LEAF, filters.scope ?? null);
    if (effective === null) return { cards: [] as Scorecard[], applied_scope: null, max_scope: max };

    const visible = await this.scope.visibleUserIds(orgId, principal.userId, effective);
    const now = await this.clock.now(orgId);
    const cards = await this.compute(orgId, visible, filters, now, { includeDetail: true });
    const sorted = Array.from(cards.values()).sort((a, b) => b.metrics.total_given - a.metrics.total_given || a.employee.name.localeCompare(b.employee.name));

    return {
      cards: sorted,
      totals: this.totalsOf(sorted),
      applied_scope: effective,
      max_scope: max,
    };
  }

  // ─── Core builder ────────────────────────────────────────────────────────────--

  private async compute(
    orgId: string,
    targetUserIds: string[] | 'ALL',
    filters: ScorecardFilters,
    now: Date,
    opts: ComputeOpts,
  ): Promise<Map<string, Scorecard>> {
    // Default window = all-time (like the client's "data as on" report). A supplied
    // range narrows entries by the date they were created / fell due.
    const from = filters.from_date ? new Date(filters.from_date) : null;
    const to = filters.to_date ? new Date(filters.to_date) : null;
    const dateWhere = from || to ? { created_at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};

    const people = await this.loadPeople(orgId, targetUserIds);
    const acc = new Map<string, Acc>();
    for (const p of people) {
      acc.set(p.user_id, {
        employee: p,
        titles: new Set<string>(),
        total: 0, completed: 0, overdue: 0, ongoing: 0, onTime: 0, completedWithDate: 0, noDate: 0,
        delaySum: 0, delayMax: null, pendingAgeSum: 0, pendingAgeMax: null,
        entries: [],
      });
    }
    if (acc.size === 0) return new Map();

    const idSet = new Set(acc.keys());
    const inTarget = (uid: string | null | undefined) => !!uid && idSet.has(uid);
    const assigneeUserFilter = targetUserIds === 'ALL' ? undefined : { in: Array.from(idSet) };
    const deptOf = new Map(people.map((p) => [p.user_id, p.department_name]));

    // Frequency label per template (all templates, incl. paused) + assigner names.
    // uniqueCounts = distinct active recurring templates each person holds (cheap;
    // always computed so the roster can show it too).
    const [freqByTemplate, uniqueCounts, holderTable] = await Promise.all([
      this.frequencyMap(orgId),
      this.recurringUniqueCounts(orgId, idSet),
      opts.includeDetail ? this.recurringHoldings(orgId, idSet, now) : Promise.resolve(new Map<string, RecurringRow[]>()),
    ]);

    // One pass over every task assigned to the target set (one-time + recurring occurrences).
    const tasks = await this.prisma.task.findMany({
      where: {
        organization_id: orgId,
        is_deleted: false,
        ...dateWhere,
        assignees: { some: { is_cc: false, ...(assigneeUserFilter ? { user_id: assigneeUserFilter } : {}) } },
      },
      select: {
        id: true,
        title: true,
        recurring_template_id: true,
        created_by_user_id: true,
        deadline: true,
        completed_at: true,
        completed_by_user_id: true,
        completion_timing: true,
        completion_mode: true,
        is_overdue: true,
        status: { select: { label: true, type: true } },
        assignees: { where: { is_cc: false }, select: { user_id: true, is_completed: true, completed_at: true, cannot_complete: true } },
      },
      take: ROW_CAP,
    });

    // Resolve assigner names once.
    const creatorIds = Array.from(new Set(tasks.map((t) => t.created_by_user_id).filter(Boolean))) as string[];
    const creators = creatorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } })
      : [];
    const creatorName = new Map(creators.map((c) => [c.id, c.name]));

    for (const t of tasks) {
      const frequency = t.recurring_template_id ? (freqByTemplate.get(t.recurring_template_id) ?? 'Recurring') : 'One-time';
      const deadline = t.deadline ?? null;
      const past = !!deadline && deadline <= now;
      const anyCan = t.completion_mode !== 'all_must_complete';

      for (const a of t.assignees) {
        if (!inTarget(a.user_id)) continue;
        const row = acc.get(a.user_id)!;

        // Per-person completion for this entry.
        const completed = anyCan ? isSuccessful(t.status?.type) : a.is_completed;
        const completionDate = anyCan ? (t.completed_at ?? null) : (a.completed_at ?? null);

        // Signed delay + on-time. Judgeable only when the entry is completed AND
        // carries both a completion date and a due date (matches the client sheet:
        // pending / undated tasks are kept out of the On-Time Rate denominator).
        let delayDays: number | null = null;
        let onTime: 'Yes' | 'No' | '' = '';
        const hasDates = completed && !!completionDate && !!deadline;
        if (hasDates) {
          delayDays = Math.floor((completionDate!.getTime() - deadline!.getTime()) / DAY_MS);
          onTime = delayDays <= 0 ? 'Yes' : 'No'; // finished on OR before due = on time
        }

        // Where the entry stands TODAY (from the dates) + how late it is.
        //   completed    → done; days_late = signed completion − due
        //   overdue      → open and past due; days_late = today − due (positive, grows daily)
        //   in_progress  → open, not past due, work started
        //   not_yet_due  → open, not past due, work not started
        //   closed       → terminally closed but not a success (partial / incomplete)
        const terminalNotSuccess = !completed && isTerminal(t.status?.type);
        let dateStatus: EntryDateStatus;
        let daysLate: number | null = null;
        if (completed) {
          dateStatus = 'completed';
          daysLate = delayDays; // signed; may be early (negative) or null if no dates
        } else if (terminalNotSuccess) {
          dateStatus = 'closed';
        } else if (past) {
          dateStatus = 'overdue';
          daysLate = Math.floor((now.getTime() - deadline!.getTime()) / DAY_MS);
        } else {
          dateStatus = t.status?.type === 'in_progress' ? 'in_progress' : 'not_yet_due';
        }

        // Metric buckets. Total = every entry given; distinct titles = real scope.
        row.total += 1;
        row.titles.add(t.title);
        if (completed) {
          row.completed += 1;
          if (hasDates) {
            row.completedWithDate += 1;
            row.delaySum += delayDays!;
            if (row.delayMax === null || delayDays! > row.delayMax) row.delayMax = delayDays!;
            if (onTime === 'Yes') row.onTime += 1;
          } else {
            row.noDate += 1; // completed but no date entered — a data gap, not a work gap
          }
        } else if (dateStatus === 'overdue') {
          row.overdue += 1;
          row.pendingAgeSum += daysLate!;
          if (row.pendingAgeMax === null || daysLate! > row.pendingAgeMax) row.pendingAgeMax = daysLate!;
        } else if (!terminalNotSuccess) {
          row.ongoing += 1;
        }

        if (opts.includeDetail) {
          row.entries.push({
            task_id: t.id,
            title: t.title,
            frequency,
            department: deptOf.get(a.user_id) ?? null,
            assigned_by: t.created_by_user_id ? creatorName.get(t.created_by_user_id) ?? null : null,
            due_date: deadline ? deadline.toISOString() : null,
            completion_date: completionDate ? completionDate.toISOString() : null,
            status: t.status?.label ?? null,
            date_status: dateStatus,
            delay_days: delayDays,
            days_late: daysLate,
            on_time: onTime,
          });
        }
      }
    }

    // Assemble.
    const out = new Map<string, Scorecard>();
    for (const [uid, r] of acc) {
      const metrics = finalize(this.rawOf(r));
      metrics.recurring_unique = uniqueCounts.get(uid) ?? 0;
      if (opts.includeDetail) {
        r.entries.sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
      }
      out.set(uid, {
        employee: r.employee,
        metrics,
        recurring_tasks: holderTable.get(uid) ?? [],
        entries: r.entries,
      });
    }
    return out;
  }

  /** Project a per-person accumulator to the raw counts `finalize` needs. */
  private rawOf(r: Acc): RawCounts {
    return {
      different: r.titles.size,
      total: r.total,
      completed: r.completed,
      overdue: r.overdue,
      ongoing: r.ongoing,
      onTime: r.onTime,
      completedWithDate: r.completedWithDate,
      noDate: r.noDate,
      delaySum: r.delaySum,
      delayMax: r.delayMax,
      pendingAgeSum: r.pendingAgeSum,
      pendingAgeMax: r.pendingAgeMax,
    };
  }

  /**
   * The Overall / Total row. Sums are additive (incl. Different Tasks Handled =
   * Σ per-person distinct counts, exactly like the client sheet), then ratios and
   * the average delay are recomputed from the summed raw — never averaged twice.
   */
  private totalsOf(cards: Iterable<Scorecard>): ScorecardTotals {
    const agg: RawCounts = {
      different: 0, total: 0, completed: 0, overdue: 0, ongoing: 0,
      onTime: 0, completedWithDate: 0, noDate: 0, delaySum: 0, delayMax: null,
      pendingAgeSum: 0, pendingAgeMax: null,
    };
    for (const c of cards) {
      const m = c.metrics;
      agg.different += m.different_tasks;
      agg.total += m.total_given;
      agg.completed += m.completed;
      agg.overdue += m.overdue;
      agg.ongoing += m.ongoing;
      agg.onTime += m.completed_on_time;
      agg.completedWithDate += m.completed_with_date;
      agg.noDate += m.completed_no_date;
      if (m.completed_with_date > 0 && m.avg_delay_days !== null) agg.delaySum += m.avg_delay_days * m.completed_with_date;
      if (m.longest_delay_days !== null && (agg.delayMax === null || m.longest_delay_days > agg.delayMax)) agg.delayMax = m.longest_delay_days;
      if (m.overdue > 0 && m.avg_pending_age_days !== null) agg.pendingAgeSum += m.avg_pending_age_days * m.overdue;
      if (m.longest_pending_age_days !== null && (agg.pendingAgeMax === null || m.longest_pending_age_days > agg.pendingAgeMax)) agg.pendingAgeMax = m.longest_pending_age_days;
    }
    const { grade: _drop, recurring_unique: _r, ...totals } = finalize(agg);
    return totals;
  }

  // ─── Unique recurring holdings (cadence + next run + freshness) ───────────────---

  private async recurringHoldings(orgId: string, idSet: Set<string>, now: Date): Promise<Map<string, RecurringRow[]>> {
    const templates = await this.prisma.recurringTemplate.findMany({
      where: { organization_id: orgId, is_active: true },
      select: {
        id: true,
        title: true,
        assignee_user_ids: true,
        schedule_entries: {
          where: { is_active: true },
          orderBy: { order_index: 'asc' },
          select: {
            schedule_type: true, every: true, days: true, month_days: true, yearly_dates: true,
            time: true, start_date: true, end_date: true, end_condition: true, end_after: true,
            occurrence_count: true, is_active: true,
          },
        },
      },
    });

    // Per (template, user) occurrence tally over ALL occurrences (for freshness).
    type Agg = { fired: number; done: number; onTime: number; lastCompleted: Date | null; dueOpen: Date[] };
    const agg = new Map<string, Agg>();
    const keyOf = (tid: string, uid: string) => `${tid}:${uid}`;

    const templateIds = templates.map((t) => t.id);
    if (templateIds.length) {
      const occ = await this.prisma.task.findMany({
        where: { organization_id: orgId, recurring_template_id: { in: templateIds }, is_deleted: false },
        select: {
          recurring_template_id: true, deadline: true, completed_at: true, completed_by_user_id: true,
          completion_timing: true, completion_mode: true, is_overdue: true,
          status: { select: { type: true } },
          assignees: { where: { is_cc: false }, select: { user_id: true, is_completed: true, completed_at: true } },
        },
        take: ROW_CAP,
      });
      for (const o of occ) {
        const tid = o.recurring_template_id!;
        const timing = this.timing(o);
        const deadline = o.deadline ?? null;
        const past = !!deadline && deadline <= now;
        const anyCan = o.completion_mode !== 'all_must_complete';
        for (const a of o.assignees) {
          if (!idSet.has(a.user_id)) continue;
          const k = keyOf(tid, a.user_id);
          let row = agg.get(k);
          if (!row) { row = { fired: 0, done: 0, onTime: 0, lastCompleted: null, dueOpen: [] }; agg.set(k, row); }
          row.fired += 1;
          let done = false; let doneAt: Date | null = null; let late = false;
          if (!anyCan) {
            if (a.is_completed) { done = true; doneAt = a.completed_at ?? null; late = !!(a.completed_at && deadline && a.completed_at > deadline); }
          } else if ((timing === 'early' || timing === 'on_time' || timing === 'late') && o.completed_by_user_id === a.user_id) {
            done = true; doneAt = o.completed_at ?? null; late = timing === 'late';
          }
          if (done) {
            row.done += 1;
            if (!late) row.onTime += 1;
            if (doneAt && (!row.lastCompleted || doneAt > row.lastCompleted)) row.lastCompleted = doneAt;
          } else if (past) {
            row.dueOpen.push(deadline!);
          }
        }
      }
    }

    const byUser = new Map<string, RecurringRow[]>();
    for (const tpl of templates) {
      const holders = (Array.isArray(tpl.assignee_user_ids) ? tpl.assignee_user_ids : []) as string[];
      const entries = tpl.schedule_entries as unknown as RecurrenceEntry[];
      const cadence = this.cadenceLabel(tpl.schedule_entries);
      const frequency = this.frequencyLabel(tpl.schedule_entries);
      const startDate = this.earliestStart(tpl.schedule_entries);
      const endDate = this.latestEnd(tpl.schedule_entries);
      const nextRun = this.nextRun(entries, now);
      for (const uid of holders) {
        if (!idSet.has(uid)) continue;
        const a = agg.get(keyOf(tpl.id, uid));
        const behind = a ? a.dueOpen.filter((d) => !a.lastCompleted || d > a.lastCompleted).length : 0;
        const fired = a?.fired ?? 0;
        const done = a?.done ?? 0;
        const fresh = this.freshness(fired, behind);
        const list = byUser.get(uid) ?? [];
        list.push({
          template_id: tpl.id, title: tpl.title, cadence_label: cadence, frequency,
          start_date: startDate, end_date: endDate, next_run: nextRun,
          fired, done, on_time_rate: done > 0 ? Math.round(((a?.onTime ?? 0) / done) * 100) : null,
          last_completed_at: a?.lastCompleted ? a.lastCompleted.toISOString() : null,
          freshness_state: fresh.state, freshness_label: fresh.label,
        });
        byUser.set(uid, list);
      }
    }
    for (const list of byUser.values()) list.sort((a, b) => a.title.localeCompare(b.title));
    return byUser;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────--

  /** Distinct active recurring templates each in-scope person is assigned to. */
  private async recurringUniqueCounts(orgId: string, idSet: Set<string>): Promise<Map<string, number>> {
    const templates = await this.prisma.recurringTemplate.findMany({
      where: { organization_id: orgId, is_active: true },
      select: { assignee_user_ids: true },
    });
    const counts = new Map<string, number>();
    for (const t of templates) {
      const holders = (Array.isArray(t.assignee_user_ids) ? t.assignee_user_ids : []) as string[];
      for (const uid of holders) if (idSet.has(uid)) counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }
    return counts;
  }

  private async frequencyMap(orgId: string): Promise<Map<string, string>> {
    const templates = await this.prisma.recurringTemplate.findMany({
      where: { organization_id: orgId },
      select: { id: true, schedule_entries: { select: { schedule_type: true } } },
    });
    return new Map(templates.map((t) => [t.id, this.frequencyLabel(t.schedule_entries)]));
  }

  private async loadPeople(orgId: string, targetUserIds: string[] | 'ALL'): Promise<ScorecardPerson[]> {
    const profiles = await this.prisma.employeeProfile.findMany({
      where: {
        organization_id: orgId,
        ...(targetUserIds === 'ALL' ? {} : { user_id: { in: targetUserIds } }),
      },
      select: {
        user_id: true,
        user: { select: { id: true, name: true, email: true } },
        role: { select: { title: true } },
        department: { select: { name: true } },
      },
    });
    return profiles
      .filter((p) => p.user)
      .map((p) => ({
        user_id: p.user_id,
        name: p.user!.name,
        email: p.user!.email,
        role_title: p.role?.title ?? null,
        department_name: p.department?.name ?? null,
      }));
  }

  private timing(t: { completion_timing: string | null; is_overdue: boolean; status: { type: string } | null }): Timing {
    if (t.completion_timing) return t.completion_timing as Timing;
    const phase = t.status?.type;
    if (phase === 'completed') return 'on_time';
    if (phase === 'partially_completed') return 'partial';
    if (phase === 'incomplete') return 'incomplete';
    return t.is_overdue ? 'overdue' : 'pending';
  }

  private freshness(fired: number, behind: number): { state: 'current' | 'behind' | 'none'; label: string } {
    if (fired === 0) return { state: 'none', label: '—' };
    if (behind > 0) return { state: 'behind', label: `${behind} behind` };
    return { state: 'current', label: 'Up to date' };
  }

  private jsonArr(value: unknown): number[] {
    return (Array.isArray(value) ? value : []) as number[];
  }

  /** Short frequency word for the Task Data sheet: Daily / Weekly / Monthly / Yearly / Custom. */
  private frequencyLabel(entries: { schedule_type: string }[]): string {
    if (!entries?.length) return 'Recurring';
    const types = new Set(entries.map((e) => e.schedule_type));
    if (types.size > 1) return 'Custom';
    const t = entries[0].schedule_type;
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Recurring';
  }

  /** Full human cadence label, e.g. "Weekly on Mon, Wed". */
  private cadenceLabel(entries: any[]): string {
    if (!entries?.length) return '—';
    const labelOne = (e: any): string => {
      const every = e.every && e.every > 1 ? e.every : 1;
      switch (e.schedule_type) {
        case 'daily':
          return every > 1 ? `Every ${every} days` : 'Daily';
        case 'weekly': {
          const days = this.jsonArr(e.days).map((d) => DOW[d] ?? d).join(', ');
          const base = every > 1 ? `Every ${every} weeks` : 'Weekly';
          return days ? `${base} on ${days}` : base;
        }
        case 'monthly': {
          const md = this.jsonArr(e.month_days).map((d) => (d < 0 ? 'last day' : `day ${d}`)).join(', ');
          const base = every > 1 ? `Every ${every} months` : 'Monthly';
          return md ? `${base} on ${md}` : base;
        }
        case 'yearly': {
          const yd = (Array.isArray(e.yearly_dates) ? e.yearly_dates : [])
            .map((o: any) => `${MON[(o.month ?? 1) - 1] ?? '?'} ${o.day}`)
            .join(', ');
          const base = every > 1 ? `Every ${every} years` : 'Yearly';
          return yd ? `${base} on ${yd}` : base;
        }
        default:
          return String(e.schedule_type ?? '—');
      }
    };
    return entries.map(labelOne).join('; ');
  }

  private earliestStart(entries: any[]): string | null {
    const dates = entries.map((e) => e.start_date).filter(Boolean) as Date[];
    if (!dates.length) return null;
    return new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString();
  }

  private latestEnd(entries: any[]): string | null {
    const dates = entries.map((e) => e.end_date).filter(Boolean) as Date[];
    if (!dates.length) return null;
    return new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString();
  }

  private nextRun(entries: RecurrenceEntry[], now: Date): string | null {
    if (!entries?.length) return null;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 366; i++) {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      if (entries.some((e) => shouldEntryFireToday(e, day))) return day.toISOString();
    }
    return null;
  }
}
