export type TicketStatusType =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed_resolved'
  | 'closed_unresolved'

export type TicketTemplateType = 'full' | 'simple'
export type TicketReassignmentMode = 'assignee_only' | 'admin_manager_only' | 'both'

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

export interface TicketMasterConfig {
  id: string
  organization_id: string
  ticket_creation_roles: string[]
  reassignment_mode: TicketReassignmentMode
  require_raiser_confirmation: boolean
  enable_rating: boolean
  default_escalation_levels: number
  created_at: string
  updated_at: string
}

export interface TicketType {
  id: string
  organization_id: string
  name: string
  description?: string
  color: string
  icon: string
  default_sla_days: number
  auto_assign_user_id?: string
  auto_assign_role?: string
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
  auto_assign_user_id?: string
  auto_assign_role?: string
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
  title_template: string
  description_template?: string
  auto_assign_user_id?: string
  auto_assign_role?: string
  sla_days?: number
  checklist_items: { title: string }[]
  is_active: boolean
  created_by_user_id: string
  created_at: string
  updated_at: string
  ticket_type?: TicketType
  category?: TicketCategory
  priority?: TicketPriority
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
  sla_days: number
  sla_due_at: string
  sla_breached: boolean
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
