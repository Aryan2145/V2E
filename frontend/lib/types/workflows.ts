export type WorkflowNature = 'one_time' | 'recurring'
export type WorkflowRecurringType = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type WorkflowTemplateStatus = 'draft' | 'active' | 'archived'
export type WorkflowAssigneeType = 'fixed_person' | 'role'
export type WorkflowOverdueAction = 'block_next' | 'proceed_anyway' | 'trigger_branch'
export type WorkflowStepStatus = 'pending' | 'active' | 'completed' | 'overdue' | 'skipped' | 'branched'
export type WorkflowInstanceStatus = 'running' | 'completed' | 'stuck' | 'cancelled'
export type WorkflowAccessType = 'view' | 'edit' | 'trigger'

export type DeadlineConfig =
  | { type: 'fixed_date'; date: string; time: string }
  | { type: 'daily'; time: string }
  | { type: 'weekly'; day: number; time: string }
  | { type: 'monthly'; day_of_month: number; time: string }
  | { type: 'yearly'; day: number; month: number; time: string }
  | { type: 'x_days_after_start'; days: number; time: string }
  | { type: 'x_days_after_prev_completed'; days: number; time: string }
  | { type: 'x_days_after_prev_deadline'; days: number; time: string }

export interface WorkflowStep {
  id: string
  organization_id: string
  workflow_template_id: string
  order_index: number
  title: string
  description?: string
  assignee_type: WorkflowAssigneeType
  assignee_user_id?: string
  assignee_role?: string
  assigner_user_id: string
  deadline_config: DeadlineConfig
  proof_required: boolean
  priority_id?: string
  category_id?: string
  checklist_items: { title: string; order_index: number }[]
  if_overdue_action: WorkflowOverdueAction
  branch_step_id?: string
  is_branch_step: boolean
  parent_branch_step_id?: string
  created_at: string
  updated_at: string
}

export interface WorkflowTrigger {
  id: string
  organization_id: string
  workflow_template_id: string
  type: string
  config: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowAccess {
  id: string
  organization_id: string
  workflow_template_id: string
  user_id: string
  access_type: WorkflowAccessType
  created_at: string
}

export interface WorkflowTemplate {
  id: string
  organization_id: string
  name: string
  description?: string
  owner_user_ids: string[]
  created_by_user_id: string
  status: WorkflowTemplateStatus
  show_workflow_on_task_card: boolean
  workflow_nature: WorkflowNature
  recurring_type?: WorkflowRecurringType
  created_at: string
  updated_at: string
  steps?: WorkflowStep[]
  triggers?: WorkflowTrigger[]
  access?: WorkflowAccess[]
  _count?: { instances: number }
}

export interface WorkflowInstanceStep {
  id: string
  organization_id: string
  workflow_instance_id: string
  workflow_step_id: string
  task_id?: string
  assigned_to_user_id: string
  status: WorkflowStepStatus
  scheduled_at?: string
  task_created_at?: string
  completed_at?: string
  branch_taken: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowInstance {
  id: string
  organization_id: string
  workflow_template_id: string
  name: string
  trigger_type: string
  triggered_by_user_id?: string
  status: WorkflowInstanceStatus
  started_at: string
  completed_at?: string
  current_step_id?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  template?: Pick<WorkflowTemplate, 'id' | 'name' | 'steps' | 'show_workflow_on_task_card'>
  steps?: WorkflowInstanceStep[]
}

export interface WorkflowNotification {
  id: string
  organization_id: string
  workflow_instance_id: string
  user_id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
}

export interface WorkflowMaster {
  id: string
  organization_id: string
  workflow_creation_roles: string[]
  default_overdue_action: 'block_next' | 'proceed_anyway'
  created_at: string
  updated_at: string
}
