export class UpdateTicketMasterDto {
  ticket_creation_roles?: string[]
  reassignment_mode?: 'assignee_only' | 'admin_manager_only' | 'both'
  require_raiser_confirmation?: boolean
  enable_rating?: boolean
  default_escalation_levels?: number
}
