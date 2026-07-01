export type TaskQuadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4'
export type TaskType = 'one_time' | 'recurring'
export type CompletionMode = 'all_must_complete' | 'any_can_complete'

export interface TaskMasterConfig {
  id: string
  organization_id: string
  task_creation_roles: string[]
  task_edit_roles: string[]
  task_delete_roles: string[]
  default_reminder_days_before: number
  reopen_window_minutes: number
  escalation_levels: number
  archive_view_roles: string[]
  assignee_visibility_mode?: string
  assignee_custom_rules?: Record<string, unknown>
  assignee_visibility_config_roles?: string[]
}

export interface TaskCategory {
  id: string
  organization_id: string
  name: string
  description?: string
  color: string
  is_active: boolean
  created_at: string
}

export interface TaskPriority {
  id: string
  organization_id: string
  label: string
  color: string
  order_index: number
  is_active: boolean
}

// The fixed phase a status belongs to. `completed` and `incomplete` are both terminal
// (they close the task); only `completed` counts as a successful completion.
export type TaskStatusPhase = 'not_started' | 'in_progress' | 'completed' | 'incomplete'

export const TERMINAL_STATUS_PHASES: TaskStatusPhase[] = ['completed', 'incomplete']

export interface TaskStatus {
  id: string
  organization_id: string
  label: string
  type: TaskStatusPhase
  color: string
  order_index: number
  is_default: boolean
  is_active: boolean
}

export interface TaskAssigneeUser {
  id: string
  task_id: string
  user_id: string
  user_name?: string
  user_email?: string
  user?: { id: string; name: string; email: string; department?: string | null; role_title?: string | null }
  is_completed: boolean
  completed_at?: string
  is_cc: boolean
}

export interface TaskChecklistItem {
  id: string
  task_id: string
  title: string
  /** Section label when a task carries multiple checklists; null/undefined = single ungrouped list. */
  group_title?: string | null
  is_completed: boolean
  order_index: number
}

export interface Task {
  id: string
  organization_id: string
  title: string
  description?: string
  category_id?: string
  priority_id?: string
  status_id: string
  quadrant: TaskQuadrant
  type: TaskType
  created_by_user_id: string
  department_id?: string
  completion_mode: CompletionMode
  proof_required: boolean
  proof_url?: string
  proof_submitted_at?: string
  is_deleted: boolean
  deadline?: string
  recurring_template_id?: string
  workflow_instance_step_id?: string
  workflow_step?: {
    instance_id: string
    step_order: number
    template_name: string
    instance_name: string
    show_on_card: boolean
  }
  reopen_expires_at?: string
  is_overdue?: boolean
  completed_at?: string | null
  completion_timing?: 'early' | 'on_time' | 'late' | 'incomplete' | null
  created_at: string
  updated_at: string
  category?: TaskCategory
  priority?: TaskPriority
  status?: TaskStatus
  assignees?: TaskAssigneeUser[]
  checklist?: TaskChecklistItem[]
  /** The user who created/assigned the task (resolved server-side). */
  created_by?: { id: string; name: string; email?: string } | null
  _count?: { assignees: number; checklist: number; comments: number }
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  user_name: string
  user_email: string
  body: string
  attachment_urls?: { name: string; url: string; type: string }[]
  /** Real uploaded documents attached to this comment (stored in R2). */
  attachments?: TaskAttachment[]
  reply_to_comment_id?: string
  is_deleted: boolean
  created_at: string
  replies?: TaskComment[]
}

/** A document attached to a task or a task comment, stored in object storage. */
export interface TaskAttachment {
  id: string
  task_id?: string
  comment_id?: string | null
  file_name: string
  mime_type: string
  size_bytes: number
  uploaded_by_user_id?: string
  uploaded_by_name?: string | null
  created_at: string
}

export interface TaskActivityLog {
  id: string
  task_id: string
  performed_by_user_id: string
  performed_by_name: string
  action: string
  metadata?: Record<string, unknown>
  created_at: string
}

export type RecurringScheduleType = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type RecurringEndCondition = 'never' | 'on_date' | 'after_n'

export interface YearlyDate {
  month: number
  day: number
}

export interface RecurringScheduleEntry {
  id: string
  organization_id: string
  recurring_template_id: string
  schedule_type: RecurringScheduleType
  every: number
  days: number[]
  month_days: number[]
  yearly_dates: YearlyDate[]
  time: string
  start_date: string
  end_condition: RecurringEndCondition
  end_date?: string
  end_after?: number
  occurrence_count: number
  is_active: boolean
  order_index: number
  created_at: string
  updated_at: string
}

export interface RecurringTemplate {
  id: string
  organization_id: string
  title: string
  description?: string
  quadrant: TaskQuadrant
  category_id?: string
  priority_id?: string
  has_multiple_schedules: boolean
  is_active: boolean
  completion_mode: string
  proof_required: boolean
  assignee_user_ids: string[]
  cc_user_ids: string[]
  department_id?: string
  created_at: string
  schedule_entries?: RecurringScheduleEntry[]
}

export interface TaskArchiveItem {
  id: string
  original_task_id: string
  task_snapshot: Task
  deleted_by_user_id: string
  deleted_by?: { id: string; name: string; email: string } | null
  deletion_reason?: string
  deleted_at: string
}

export type ChecklistAccessMode = 'everyone' | 'restricted'
export type ChecklistAccessKind = 'department' | 'role' | 'user' | 'exclude_user' | 'exclude_role'

export interface ChecklistAccessRule {
  id: string
  kind: ChecklistAccessKind
  department_id: string | null
  include_sub_departments: boolean
  role_id: string | null
  user_id: string | null
}

export interface ChecklistTemplate {
  id: string
  organization_id: string
  name: string
  items: { title: string; order_index: number }[]
  access_mode: ChecklistAccessMode
  access_rules: ChecklistAccessRule[]
  is_active: boolean
  created_at: string
}

export interface ChecklistAccessRuleInput {
  kind: ChecklistAccessKind
  department_id?: string
  include_sub_departments?: boolean
  role_id?: string
  user_id?: string
}

export interface ChecklistTemplateInput {
  name: string
  items: { title: string; order_index: number }[]
  access_mode?: ChecklistAccessMode
  access_rules?: ChecklistAccessRuleInput[]
  is_active?: boolean
}

// ─── Checklist bulk import ──────────────────────────────────────────────────────

export interface BulkImportChecklistRow {
  checklist_name?: string
  item?: string
}

export interface ChecklistImportRowIssue {
  field?: string
  message: string
  severity: 'error' | 'warning'
}

export interface ChecklistImportRow {
  row: number
  checklist_name: string
  item: string
  status: 'ready' | 'error'
  issues: ChecklistImportRowIssue[]
}

export interface ChecklistImportGroup {
  name: string
  items: string[]
  already_exists: boolean
}

export interface ChecklistImportValidationResult {
  total: number
  ready: number
  errors: number
  warnings: number
  templates: number
  rows: ChecklistImportRow[]
  groups: ChecklistImportGroup[]
}

export interface ChecklistImportGroupResult {
  name: string
  item_count: number
  status: 'created' | 'failed'
  error?: string
}

export interface ChecklistImportResult {
  batch_id: string | null
  created: number
  failed: number
  results: ChecklistImportGroupResult[]
}

export interface ChecklistUndoKeptRow {
  name: string
  reason: string
}

export interface ChecklistUndoImportResult {
  batch_id: string
  undone: number
  kept: ChecklistUndoKeptRow[]
  status: 'committed' | 'undone' | 'partially_undone'
}

export interface ChecklistImportBatchSummary {
  id: string
  file_name: string | null
  imported_by: string
  total_rows: number
  created_count: number
  failed_count: number
  remaining: number
  status: 'committed' | 'undone' | 'partially_undone'
  can_undo: boolean
  created_at: string
  undone_at: string | null
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface UserPerformance {
  user_id: string
  user: { id: string; name: string; email: string } | null
  total: number
  completed: number
  overdue: number
}

export interface DeptPerformance {
  department_id: string
  department: { id: string; name: string } | null
  total: number
  completed: number
  overdue: number
}

export interface BreakdownItem {
  label: string
  color: string
  total: number
  completed: number
  overdue: number
}

export interface StatusBreakdown {
  label: string
  color: string
  total: number
}

export interface TaskReportData {
  total_tasks: number
  user_performance: UserPerformance[]
  department_performance: DeptPerformance[]
  priority_breakdown: BreakdownItem[]
  category_breakdown: BreakdownItem[]
  status_breakdown: StatusBreakdown[]
  frequency_breakdown: {
    recurring: { total: number; completed: number }
    one_time: { total: number; completed: number }
  }
}

// ─── Work Dashboard (scope-aware canvas) ────────────────────────────────────────

export type WorkScope = 'own' | 'team' | 'department' | 'org'

/** Completion-timing taxonomy — the analytical spine of the Work dashboard. */
export type Timing = 'early' | 'on_time' | 'late' | 'overdue' | 'incomplete' | 'pending'

export const TIMINGS: Timing[] = ['early', 'on_time', 'late', 'overdue', 'incomplete', 'pending']

export type TimingCounts = Record<Timing, number>

/** Brand-system colors + labels for each timing bucket (DESIGN_RULES palette). */
export const TIMING_META: Record<Timing, { label: string; color: string }> = {
  early: { label: 'Completed Early', color: '#16A34A' },   // success green
  on_time: { label: 'Completed On-Time', color: '#2563EB' }, // primary blue
  late: { label: 'Completed Late', color: '#D97706' },     // warning amber
  overdue: { label: 'Overdue', color: '#DC2626' },         // danger red
  incomplete: { label: 'Incomplete', color: '#92400E' },   // dark amber/brown — closed-not-done
  pending: { label: 'Pending', color: '#94A3B8' },         // muted slate
}

export const emptyTiming = (): TimingCounts => ({ early: 0, on_time: 0, late: 0, overdue: 0, incomplete: 0, pending: 0 })

/** Sum two timing-count records (used for subtree roll-ups on the client). */
export function addTiming(a: TimingCounts, b: TimingCounts): TimingCounts {
  return { early: a.early + b.early, on_time: a.on_time + b.on_time, late: a.late + b.late, overdue: a.overdue + b.overdue, incomplete: a.incomplete + b.incomplete, pending: a.pending + b.pending }
}

/** Which timing bucket a single task falls in (mirrors the server's classification). */
export function taskTiming(t: Task): Timing {
  if (t.completion_timing) return t.completion_timing
  if (t.status?.type === 'completed') return 'on_time'
  if (t.status?.type === 'incomplete') return 'incomplete'
  return t.is_overdue ? 'overdue' : 'pending'
}

export interface DashboardKpis {
  total: number
  not_started: number
  ongoing: number
  completed: number
  overdue: number
  due_today: number
  due_week: number
  recurring: number
  // Timing-derived headline metrics
  completed_early: number
  completed_on_time: number
  completed_late: number
  critical_high_open: number
  completion_rate: number
  on_time_rate: number
  recurring_share: number
  delta: number | null // month-over-month completion-rate change (pts)
  overdue_aging: { d0_7: number; d8_30: number; d30_plus: number }
}

export interface DashboardBreakdownItem {
  id: string | null
  label: string
  color?: string
  type?: string | null
  order_index?: number
  total: number
  timing: TimingCounts
}

export interface TrendPoint {
  week: string
  created: number
  completed: number
  on_time: number
}

export interface MonthlyTrendPoint {
  month: string
  due: number
  completed: number
  on_time: number
  on_time_rate: number | null
}

export interface TaskDashboard {
  applied_scope: WorkScope | null
  max_scope: WorkScope | null
  kpis: DashboardKpis
  by_status: DashboardBreakdownItem[]
  by_priority: DashboardBreakdownItem[]
  by_category: DashboardBreakdownItem[]
  by_department: DashboardBreakdownItem[]
  by_type: DashboardBreakdownItem[]
  by_assignee: DashboardBreakdownItem[]
  by_assigner: DashboardBreakdownItem[]
  by_role: DashboardBreakdownItem[]
  by_timing: TimingCounts
  trend: TrendPoint[]
  trend_monthly: MonthlyTrendPoint[]
}

/** A source/flow breakdown row (Immediate/Same-dept/External, or a department). */
export interface SourceItem {
  id: string
  label: string
  total: number
  timing: TimingCounts
}

/** Cross-department giving×receiving heatmap (top-level departments). */
export interface FlowMatrix {
  depts: { id: string; name: string; color?: string | null }[]
  rows: { from: string; cells: number[] }[]
}

/** Scope-aware "where work comes from" analytics (from GET /tasks/flow). */
export interface WorkFlow {
  applied_scope: WorkScope | null
  max_scope: WorkScope | null
  by_source: SourceItem[]              // Immediate / Same-dept / External (assignee perspective)
  matrix: FlowMatrix                   // giving root × receiving root (org)
  incoming_by_source: SourceItem[]     // Within team / Same dept / External (team/dept scope)
  external_by_dept: SourceItem[]       // which outside department loads us most
  outgoing: { by_dept: SourceItem[]; overdue: number } // work the set pushed outside
  delegated: { total: number; open: number; overdue: number; timing: TimingCounts } // work the set handed out
}

export interface PersonNode {
  user_id: string
  name: string
  role_title: string | null
  department_name: string | null
  reporting_to_user_id: string | null
  assignee: { total: number; overdue: number; completed: number }
  assignee_timing: TimingCounts
  assigned_count: number
}

export interface PeopleTree {
  nodes: PersonNode[]
  root_user_id: string
}

export interface EmployeeReport {
  employee: { id: string; name: string; email: string; role_title: string | null; department_name: string | null }
  as_assignee: DashboardKpis
  as_assigner: DashboardKpis
  assignee_breakdowns: {
    by_status: DashboardBreakdownItem[]
    by_priority: DashboardBreakdownItem[]
    by_category: DashboardBreakdownItem[]
    by_department: DashboardBreakdownItem[]
    by_type: DashboardBreakdownItem[]
    by_assigner: DashboardBreakdownItem[]
  }
}

export type BulkAction = 'status' | 'deadline' | 'complete'

export interface PagedTasks {
  items: Task[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

/** Query params shared by the dashboard + paged list endpoints. */
export interface WorkQuery {
  scope?: WorkScope
  status_id?: string
  priority_id?: string
  category_id?: string
  department_id?: string
  department_ids?: string // comma-separated — a department subtree drill
  role_id?: string // job-role drill (resolved to its assignees server-side)
  timing?: Timing // a completion-timing slice
  assigner_person_dept_id?: string // matrix drill: tasks given by a department's people
  assignee_person_dept_id?: string // matrix drill: tasks received by a department's people
  created_by_user_id?: string
  assignee_user_id?: string
  type?: string
  search?: string
  from_date?: string
  to_date?: string
  bucket?: string
  page?: number
  page_size?: number
  sort?: string
}

export type WorkBucket =
  | 'overdue' | 'due_today' | 'due_week' | 'completed' | 'ongoing' | 'not_started' | 'recurring'

// ─── Collective ───────────────────────────────────────────────────────────────

export interface CollectiveOrgTasks {
  organization: { id: string; name: string; slug: string }
  role: string
  tasks: Task[]
}

// ─── Assignee Selector ────────────────────────────────────────────────────────

export type AssigneeVisibilityMode = 'hierarchy_and_dept' | 'hierarchy_only' | 'dept_only' | 'custom'

export interface AssigneeCustomRules {
  include_departments: string[]
  exclude_departments: string[]
  include_roles: string[]
  exclude_roles: string[]
  allow_cross_dept: boolean
  allow_outside_hierarchy: boolean
}

export interface EligibleAssigneeUser {
  user_id: string
  name: string
  avatar_url: string | null
  role_title: string
  department_id: string
  department_name: string
  active_task_count: number
  frequency_count: number
  is_frequent: boolean
  on_leave_today?: boolean
  leave_until?: string | null
}

export interface EligibleAssigneeGroup {
  department_id: string
  department_name: string
  users: EligibleAssigneeUser[]
}

export interface EligibleAssigneesResponse {
  departments: EligibleAssigneeGroup[]
  total: number
}

// ─── Assignee Visibility (admin model) ──────────────────────────────────────────

export type BridgeDepth = 'head_senior' | 'whole_dept'

export interface AssigneeVisibilitySettings {
  master_override: boolean
  full_visibility_roles: string[]
  full_visibility_users: string[]
  config_roles: string[]
}

export interface AssigneeBridge {
  id: string
  from_department_id: string
  from_department_name: string | null
  to_department_id: string
  to_department_name: string | null
  depth: BridgeDepth
  include_sub_departments: boolean
  match_count: number
}

export interface AssigneeDeptUpward {
  id: string
  name: string
  parent_department_id: string | null
  color: string | null
  assignee_allow_upward: boolean
  assignee_unify_subtree: boolean
}

export interface AssigneeVisibilityAdminView {
  settings: AssigneeVisibilitySettings
  bridges: AssigneeBridge[]
  departments: AssigneeDeptUpward[]
}

export interface AssigneeExplainResult {
  user_id: string
  total: number
  trace: {
    reason: string
    exception_id?: string
    exception_scope?: string
    bridges_used?: { to_department_id: string; depth: string; match_count: number; include_sub?: boolean }[]
    direct_manager_included?: boolean
  }
  users: {
    user_id: string
    name: string
    department_id: string
    department_name: string
    role_title: string
    role_level: string
    member_role: string | null
    reporting_to_user_id: string | null
  }[]
}

export interface SelectedAssignee {
  user_id: string
  name: string
  is_cc: boolean
}

// ─── Per-employee assignee editor (most-granular layer) ─────────────────────────

export type AssigneeReason =
  | 'self'
  | 'subordinate'
  | 'direct_manager'
  | 'department'
  | 'unified_subtree'
  | 'bridge'
  | 'full_visibility'
  | 'master_override'
  | 'manual_add'

export interface EmployeeAssigneeUser extends EligibleAssigneeUser {
  reason: AssigneeReason
  manually_added: boolean
}

export interface EmployeeAssigneeGroup {
  department_id: string
  department_name: string
  users: EmployeeAssigneeUser[]
}

export interface EmployeeManualOverride {
  employee_user_id: string
  added_user_ids: string[]
  removed_user_ids: string[]
}

export interface EmployeeAssigneeRemoved {
  user_id: string
  name: string
  role_title: string
  department_id: string
  department_name: string
  would_be_reason: AssigneeReason | null
}

export interface EmployeeAssigneePreview {
  employee: { user_id: string; name: string; role_title: string; department_id: string; department_name: string }
  trace: {
    reason: string
    manual_added_count?: number
    manual_removed_count?: number
  }
  override: EmployeeManualOverride
  departments: EmployeeAssigneeGroup[]
  removed: EmployeeAssigneeRemoved[]
  total: number
}
