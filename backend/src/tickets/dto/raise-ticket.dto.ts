export class RaiseTicketDto {
  title: string
  description?: string
  ticket_type_id: string
  category_id?: string
  priority_id?: string
  template_id?: string
  assigned_to_user_id?: string
  proof_required?: boolean
  checklist_items?: { title: string }[]
  escalation_user_ids?: string[]
}
