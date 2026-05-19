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
  user_name: string
  user_email: string
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

export interface RecurringTemplate {
  id: string
  organization_id: string
  title: string
  description?: string
  quadrant: TaskQuadrant
  schedule_type: string
  every: number
  days: number[]
  time: string
  start_date: string
  end_condition: string
  is_active: boolean
  occurrence_count: number
  assignee_user_ids: string[]
  created_at: string
}

export interface TaskArchiveItem {
  id: string
  original_task_id: string
  task_snapshot: Task
  deleted_by_user_id: string
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
