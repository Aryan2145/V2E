export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled'
export type ProjectMemberRole = 'manager' | 'editor' | 'viewer'
export type TaskVisibility = 'own_tasks_only' | 'all_member_tasks'
export type MilestoneStatus = 'pending' | 'in_progress' | 'achieved'
export type ProjectActivityAction =
  | 'created' | 'member_added' | 'member_removed' | 'member_role_changed'
  | 'status_changed' | 'milestone_created' | 'milestone_achieved'
  | 'task_added' | 'task_completed' | 'task_removed'
  | 'dependency_added' | 'dependency_removed' | 'comment_added'
  | 'document_added' | 'budget_updated' | 'template_applied' | 'deleted'

export interface ProjectMasterConfig {
  id: string
  organization_id: string
  project_creation_roles: string[]
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  organization_id: string
  name: string
  description?: string
  status: ProjectStatus
  /**
   * The goals this project serves. Many-to-many — one project can move several
   * goals at once, so this is a list, not a single foreign key.
   */
  goals?: { goal: { id: string; title: string; status: string; due_date: string } }[]
  status_reason?: string
  created_by_user_id: string
  project_manager_user_id: string
  template_id?: string
  start_date?: string
  end_date?: string
  planned_budget?: number
  actual_spent?: number
  currency: string
  completion_percentage: number
  total_tasks: number
  completed_tasks: number
  total_milestones: number
  achieved_milestones: number
  is_deleted: boolean
  deleted_by_user_id?: string
  deleted_at?: string
  deletion_reason?: string
  created_at: string
  updated_at: string
  members?: ProjectMember[]
  milestones?: ProjectMilestone[]
  project_tasks?: ProjectTask[]
  _count?: { members: number; project_tasks: number }
}

export interface ProjectMember {
  id: string
  organization_id: string
  project_id: string
  user_id: string
  role: ProjectMemberRole
  task_visibility: TaskVisibility
  added_by_user_id: string
  created_at: string
  updated_at: string
}

export interface ProjectMilestone {
  id: string
  organization_id: string
  project_id: string
  name: string
  description?: string
  order_index: number
  due_date?: string
  status: MilestoneStatus
  achieved_at?: string
  total_tasks: number
  completed_tasks: number
  completion_percentage: number
  created_at: string
  updated_at: string
  tasks?: ProjectTask[]
}

export interface ProjectTask {
  id: string
  organization_id: string
  project_id: string
  milestone_id?: string
  task_id?: string
  template_task_id?: string
  order_index: number
  created_at: string
  updated_at: string
  task?: {
    id: string
    title: string
    description?: string
    status_id: string
    priority_id?: string
    deadline?: string
    status?: { id: string; label: string; type: string; color: string }
    priority?: { id: string; label: string; color: string }
    assignees?: { user_id: string; is_cc: boolean; is_completed: boolean }[]
  } | null
}

export interface ProjectTaskDependency {
  id: string
  organization_id: string
  project_id: string
  task_id: string
  depends_on_task_id: string
  created_at: string
}

export interface DependencyWarning {
  task_id: string
  title: string
  status_label: string
}

export interface ProjectComment {
  id: string
  organization_id: string
  project_id: string
  user_id: string
  body: string
  attachment_urls: { name: string; url: string }[]
  reply_to_comment_id?: string
  is_deleted: boolean
  deleted_at?: string
  created_at: string
  updated_at: string
}

export interface ProjectDocument {
  id: string
  organization_id: string
  project_id: string
  name: string
  url: string
  type?: string
  uploaded_by_user_id: string
  created_at: string
  updated_at: string
}

export interface ProjectActivityLog {
  id: string
  organization_id: string
  project_id: string
  performed_by_user_id: string
  action: ProjectActivityAction
  metadata: Record<string, unknown>
  created_at: string
}

export interface ProjectTemplate {
  id: string
  organization_id: string
  name: string
  description?: string
  created_by_user_id: string
  is_active: boolean
  created_at: string
  updated_at: string
  milestones?: ProjectTemplateMilestone[]
  tasks?: ProjectTemplateTask[]
  _count?: { milestones: number; tasks: number }
}

export interface ProjectTemplateMilestone {
  id: string
  organization_id: string
  project_template_id: string
  name: string
  description?: string
  order_index: number
  created_at: string
  updated_at: string
  tasks?: ProjectTemplateTask[]
}

export interface ProjectTemplateTask {
  id: string
  organization_id: string
  project_template_id: string
  milestone_id?: string
  title: string
  description?: string
  priority_id?: string
  checklist_items: { title: string }[]
  default_assignee_user_id?: string
  default_assignee_role?: string
  order_index: number
  estimated_days?: number
  created_at: string
  updated_at: string
}

export interface ProjectProgress {
  project_id: string
  completion_percentage: number
  total_tasks: number
  completed_tasks: number
  total_milestones: number
  achieved_milestones: number
}
