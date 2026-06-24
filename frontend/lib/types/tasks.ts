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

export interface TaskStatus {
  id: string
  organization_id: string
  label: string
  type: string
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
  created_at: string
  updated_at: string
  category?: TaskCategory
  priority?: TaskPriority
  status?: TaskStatus
  assignees?: TaskAssigneeUser[]
  checklist?: TaskChecklistItem[]
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
  reply_to_comment_id?: string
  is_deleted: boolean
  created_at: string
  replies?: TaskComment[]
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

export interface ChecklistTemplate {
  id: string
  organization_id: string
  name: string
  items: { title: string; order_index: number }[]
  created_at: string
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

export type AssigneeExceptionScope = 'user' | 'role' | 'department'
export type AssigneeExceptionKind = 'widen' | 'narrow'
export type BridgeDepth = 'head_senior' | 'whole_dept'

export interface AssigneeVisibilitySettings {
  master_override: boolean
  full_visibility_roles: string[]
  full_visibility_users: string[]
  config_roles: string[]
}

export interface AssigneeException {
  id: string
  scope: AssigneeExceptionScope
  kind: AssigneeExceptionKind
  scope_user_id: string | null
  scope_user_name: string | null
  scope_role: string | null
  scope_department_id: string | null
  scope_department_name: string | null
  members: { user_id: string; name: string | null }[]
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
  exceptions: AssigneeException[]
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
