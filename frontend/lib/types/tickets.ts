export type TicketStatusType =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'on_hold'
  | 'resolved'
  | 'closed_resolved'
  | 'closed_unresolved'

export type TicketTemplateType = 'full' | 'simple'
export type TicketReassignmentMode = 'assignee_only' | 'admin_manager_only' | 'both'
export type TicketAssignmentStrategy = 'round_robin' | 'claim' | 'manual'
export type TicketTemplateAccessMode = 'everyone' | 'restricted'
export type TicketTemplateAccessKind = 'department' | 'role' | 'user' | 'exclude_user' | 'exclude_role'

export type TicketActivityAction =
  | 'created'
  | 'assigned'
  | 'reassigned'
  | 'status_changed'
  | 'accepted'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'escalated'
  | 'comment_added'
  | 'comment_deleted'
  | 'proof_attached'
  | 'checklist_updated'
  | 'rating_submitted'
  | 'deleted'
  | 'sla_breached'
  | 'confirmation_requested'
  | 'raiser_confirmed'
  | 'rejected'
  | 'transferred'
  | 'put_on_hold'
  | 'resumed'
  | 'first_responded'
  | 'response_breached'
  | 'claimed'

export interface TicketMasterConfig {
  id: string
  organization_id: string
  ticket_creation_roles: string[]
  reassignment_mode: TicketReassignmentMode
  require_raiser_confirmation: boolean
  enable_rating: boolean
  default_escalation_levels: number
  default_response_sla_hours?: number | null
  escalation_interval_hours: number
  allow_requester_reopen: boolean
  allow_assignee_reopen: boolean
  created_at: string
  updated_at: string
}

export interface TicketResolverGroupMember {
  id: string
  organization_id: string
  resolver_group_id: string
  user_id: string
  created_at: string
}

export interface TicketResolverGroup {
  id: string
  organization_id: string
  name: string
  description?: string | null
  department_id?: string | null
  assignment_strategy: TicketAssignmentStrategy
  is_active: boolean
  created_at: string
  updated_at: string
  members: TicketResolverGroupMember[]
}

export interface TicketTemplateAccessRule {
  id?: string
  kind: TicketTemplateAccessKind
  department_id?: string | null
  include_sub_departments?: boolean
  role_id?: string | null
  user_id?: string | null
}

export interface TicketType {
  id: string
  organization_id: string
  name: string
  description?: string
  color: string
  icon: string
  default_sla_days: number
  default_response_sla_hours?: number | null
  auto_assign_user_id?: string
  auto_assign_role?: string
  resolver_group_id?: string | null
  is_active: boolean
  order_index: number
  created_at: string
  updated_at: string
}

export interface TicketCategory {
  id: string
  organization_id: string
  name: string
  description?: string
  color: string
  ticket_type_id?: string
  default_sla_days?: number
  default_response_sla_hours?: number | null
  auto_assign_user_id?: string
  auto_assign_role?: string
  resolver_group_id?: string | null
  visible_to_departments: string[]
  visible_to_roles: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  ticket_type?: TicketType
}

export interface TicketPriority {
  id: string
  organization_id: string
  label: string
  color: string
  sla_days?: number
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TicketTemplate {
  id: string
  organization_id: string
  name: string
  template_type: TicketTemplateType
  ticket_type_id?: string
  category_id?: string
  priority_id?: string
  resolver_group_id?: string | null
  department_id?: string | null
  group_label?: string | null
  title_template: string
  description_template?: string
  auto_assign_user_id?: string
  auto_assign_role?: string
  sla_days?: number
  response_sla_hours?: number | null
  lock_priority: boolean
  checklist_items: { title: string }[]
  access_mode: TicketTemplateAccessMode
  is_active: boolean
  created_by_user_id: string
  created_at: string
  updated_at: string
  ticket_type?: TicketType
  category?: TicketCategory
  priority?: TicketPriority
  resolver_group?: TicketResolverGroup
  access_rules?: TicketTemplateAccessRule[]
}

export interface TicketStatus {
  id: string
  organization_id: string
  label: string
  type: TicketStatusType
  color: string
  order_index: number
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TicketChecklist {
  id: string
  organization_id: string
  ticket_id: string
  title: string
  is_completed: boolean
  order_index: number
  created_at: string
  updated_at: string
}

export interface TicketEscalation {
  id: string
  organization_id: string
  ticket_id: string
  level: number
  escalate_to_user_id: string
  escalated_at?: string
  is_active: boolean
  created_at: string
}

export interface TicketComment {
  id: string
  organization_id: string
  ticket_id: string
  user_id: string
  body: string
  attachment_urls: string[]
  reply_to_comment_id?: string
  is_deleted: boolean
  deleted_at?: string
  created_at: string
  updated_at: string
  user_name?: string
  user_role?: string
  replies?: TicketComment[]
}

export interface TicketActivityLog {
  id: string
  organization_id: string
  ticket_id: string
  performed_by_user_id: string
  action: TicketActivityAction
  metadata?: Record<string, unknown>
  created_at: string
  user_name?: string
}

export interface Ticket {
  id: string
  organization_id: string
  ticket_number: string
  title: string
  description?: string
  ticket_type_id: string
  category_id?: string
  priority_id?: string
  status_id: string
  template_id?: string
  raised_by_user_id: string
  assigned_to_user_id?: string
  assigned_at?: string
  resolver_group_id?: string | null
  sla_days: number
  sla_due_at: string
  sla_breached: boolean
  response_sla_hours?: number | null
  response_due_at?: string | null
  responded_at?: string | null
  response_breached: boolean
  on_hold: boolean
  hold_since?: string | null
  total_hold_seconds: number
  reopen_count: number
  accepted_at?: string
  resolved_at?: string
  closed_at?: string
  resolution_note?: string
  requires_raiser_confirmation: boolean
  raiser_confirmed_at?: string
  rating?: number
  rating_comment?: string
  rated_at?: string
  proof_required: boolean
  proof_url?: string
  is_deleted: boolean
  deleted_by_user_id?: string
  deleted_at?: string
  deletion_reason?: string
  created_at: string
  updated_at: string
  ticket_type?: TicketType
  category?: TicketCategory
  priority?: TicketPriority
  status?: TicketStatus
  checklist?: TicketChecklist[]
  escalations?: TicketEscalation[]
  comments?: TicketComment[]
  activity_logs?: TicketActivityLog[]
}

export interface TicketArchiveEntry {
  id: string
  organization_id: string
  original_ticket_id: string
  raised_by_user_id: string
  ticket_snapshot: Ticket
  deleted_by_user_id: string
  deletion_reason: string
  deleted_at: string
  created_at: string
}

export interface TicketNotification {
  id: string
  organization_id: string
  ticket_id?: string
  user_id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
}

export interface TicketStats {
  open: number
  assignedToMe: number
  slaBreached: number
  resolvedThisMonth: number
}

export interface TicketReportResolutionTime {
  user_id: string
  ticket_count: number
  avg_days: number
}

export interface TicketReportBreakdown {
  label: string
  color: string
  count: number
  share: number
}

export interface TicketReportSlaBreaches {
  total: number
  breached: number
  breach_rate: number
  tickets: Ticket[]
}

export interface TicketReportRatings {
  total_ratings: number
  avg_rating: number
  distribution: { rating: number; count: number }[]
  tickets: { ticket_number: string; title: string; rating: number; rating_comment?: string; rated_at: string }[]
}

export interface TicketReportFirstResponse {
  user_id: string
  responded_count: number
  avg_hours: number
  breached_count: number
}

export interface TicketReportBacklogAging {
  total_open: number
  buckets: { label: string; count: number }[]
  oldest: {
    id: string
    ticket_number: string
    title: string
    age_days: number
    status: string
    assigned_to_user_id?: string | null
    sla_breached: boolean
  }[]
}

export interface TicketReportAgentLoad {
  user_id: string
  open: number
  in_progress: number
  on_hold: number
  breached: number
  resolved: number
  total: number
}

export interface TicketReportReopenRate {
  total_tickets: number
  reopened_tickets: number
  reopen_rate: number
  total_reopens: number
  most_reopened: { id: string; ticket_number: string; title: string; reopen_count: number }[]
}

export interface TicketAssignableUsers {
  resolver_group_id: string | null
  user_ids: string[]
}
