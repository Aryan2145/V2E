export class CreateTicketTemplateDto {
  name: string
  template_type: 'full' | 'simple'
  ticket_type_id?: string
  category_id?: string
  priority_id?: string
  title_template: string
  description_template?: string
  auto_assign_user_id?: string
  auto_assign_role?: string
  sla_days?: number
  checklist_items?: { title: string }[]
}

export class UpdateTicketTemplateDto {
  name?: string
  template_type?: 'full' | 'simple'
  ticket_type_id?: string
  category_id?: string
  priority_id?: string
  title_template?: string
  description_template?: string
  auto_assign_user_id?: string
  auto_assign_role?: string
  sla_days?: number
  checklist_items?: { title: string }[]
  is_active?: boolean
}
