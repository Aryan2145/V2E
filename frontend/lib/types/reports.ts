// Person Scorecard report — types shared by the roster + detail pages and the
// Excel export. Mirrors the backend PersonScorecardService shapes, which follow
// the client's "Person Wise Task Scorecard" format (occurrence-based metrics).

export type ScorecardScope = 'own' | 'team' | 'department' | 'org'

export interface ScorecardPerson {
  user_id: string
  name: string
  email: string | null
  role_title: string | null
  department_name: string | null
}

export type ScorecardGrade =
  | 'Very Good'
  | 'Good'
  | 'Average'
  | 'Late but Closing'
  | 'Needs Attention'
  | 'Too Few Tasks to Judge'

/** The client's discipline metric set, per person — column-for-column with the sheet. */
export interface ScorecardMetrics {
  different_tasks: number       // Different Tasks Handled (distinct task names = real scope)
  recurring_unique: number      // distinct active recurring templates held (detail view)
  total_given: number           // Total Task Entries
  avg_repeat: number | null     // Average Times Each Task Repeats (total ÷ different)
  completed: number
  pending: number               // Tasks Still Pending (overdue + ongoing)
  overdue: number
  ongoing: number
  completion_pct: number | null // Completion Rate (0–100)
  completed_on_time: number     // Finished On or Before Due Date
  completed_with_date: number   // completed entries with a completion date + due (on-time denominator)
  completed_no_date: number     // completed but no date entered — a data gap
  on_time_pct: number | null    // On Time Rate (0–100)
  avg_delay_days: number | null // COMPLETED work: Average Delay in Days (minus = early)
  longest_delay_days: number | null       // COMPLETED work: worst single delay
  avg_pending_age_days: number | null      // PENDING work: mean (today − due) over overdue tasks
  longest_pending_age_days: number | null  // PENDING work: oldest overdue task
  grade: ScorecardGrade
}

/** Overall / Total row — same numbers, no grade and no per-person template count. */
export type ScorecardTotals = Omit<ScorecardMetrics, 'grade' | 'recurring_unique'>

export interface RosterItem extends ScorecardPerson, ScorecardMetrics {}

export interface RosterResponse {
  people: RosterItem[]
  totals: ScorecardTotals
  applied_scope: ScorecardScope | null
  max_scope: ScorecardScope | null
}

/** Where a task stands today, from the dates (independent of the work stage). */
export type EntryDateStatus = 'completed' | 'overdue' | 'in_progress' | 'not_yet_due' | 'closed'

/** One row per task entry — the "Task Data" detail sheet + the person detail list. */
export interface TaskEntryRow {
  task_id: string
  title: string
  frequency: string
  department: string | null
  assigned_by: string | null
  due_date: string | null
  completion_date: string | null
  status: string | null            // work stage label (what the person did)
  date_status: EntryDateStatus     // where it stands today (from the dates)
  delay_days: number | null        // completed only: signed completion − due
  days_late: number | null         // completed → signed delay; overdue → today − due (positive); else null
  on_time: 'Yes' | 'No' | ''
}

/** Supporting "unique recurring tasks held" row. */
export interface RecurringRow {
  template_id: string
  title: string
  cadence_label: string
  frequency: string
  start_date: string | null
  end_date: string | null
  next_run: string | null
  fired: number
  done: number
  on_time_rate: number | null
  last_completed_at: string | null
  freshness_state: 'current' | 'behind' | 'none'
  freshness_label: string
}

export interface Scorecard {
  employee: ScorecardPerson
  metrics: ScorecardMetrics
  recurring_tasks: RecurringRow[]
  entries: TaskEntryRow[]
}

export interface AllScorecardsResponse {
  cards: Scorecard[]
  totals: ScorecardTotals
  applied_scope: ScorecardScope | null
  max_scope: ScorecardScope | null
}

export interface ScorecardWindow {
  from_date?: string
  to_date?: string
}

// ─── Pending & Overdue Ageing report ─────────────────────────────────────────────
// Mirrors the backend TaskAgeingService shapes (client "Pending and Overdue Ageing
// Report": Person-wise + Task-wise + Pending Task List).

export type AgeBucketKey =
  | 'not_yet_due'
  | 'd1_7'
  | 'd8_15'
  | 'd16_30'
  | 'd31_60'
  | 'd61_90'
  | 'd90_plus'

/** The seven age bands + three derived figures — one shared block per row. */
export interface AgeBuckets {
  not_yet_due: number
  d1_7: number
  d8_15: number
  d16_30: number
  d31_60: number
  d61_90: number
  d90_plus: number
  total_pending: number      // every open entry, incl. Not Yet Due
  over_month_late: number     // d31_60 + d61_90 + d90_plus
  oldest_late_days: number | null
  avg_late_days: number | null
}

export interface PersonAgeRow extends AgeBuckets {
  user_id: string
  name: string
  role_title: string | null
  department_name: string | null
}

export interface TaskAgeRow extends AgeBuckets {
  title: string
  frequency: string
}

export interface PendingTaskRow {
  task_id: string
  title: string
  assigned_to: string
  assigned_to_user_id: string
  assigned_by: string | null
  department: string | null
  frequency: string
  due_date: string | null
  days_late: number | null
  bucket: AgeBucketKey
  bucket_label: string
  status: 'Overdue' | 'Not Yet Due'
}

export interface AgeingReport {
  as_on_date: string
  people: PersonAgeRow[]
  tasks: TaskAgeRow[]
  pending: PendingTaskRow[]
  totals: AgeBuckets
  frequencies: string[]
  list_truncated: boolean
  applied_scope: ScorecardScope | null
  max_scope: ScorecardScope | null
}

// ─── Monthly Task Compliance Calendar ────────────────────────────────────────────
// Mirrors the backend TaskCalendarService shapes (client "Report 3").

export type DayResult = 'on_time' | 'late' | 'missed' | 'future'

export interface CalendarDay {
  day: number
  iso: string
  dow: string
  weekend: boolean
}

export interface CalendarCell {
  day: number
  result: DayResult
  task_id: string
  due_date: string
  completion_date: string | null
  status: string | null
}

export interface CalendarRow {
  title: string
  person: string
  user_id: string
  frequency: string
  department: string | null
  brought_forward: number
  scheduled: number
  on_time: number
  late: number
  missed: number
  future: number
  cells: CalendarCell[]
}

export interface CalendarTotals {
  rows: number
  brought_forward: number
  scheduled: number
  on_time: number
  late: number
  missed: number
  future: number
}

export interface CalendarReport {
  month: string
  month_label: string
  as_on_date: string
  days: CalendarDay[]
  rows: CalendarRow[]
  totals: CalendarTotals
  frequencies: string[]
  applied_scope: ScorecardScope | null
  max_scope: ScorecardScope | null
}
