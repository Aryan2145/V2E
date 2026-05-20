export class CreateTicketCategoryDto {
  name: string
  description?: string
  color: string
  ticket_type_id?: string
  default_sla_days?: number
  auto_assign_user_id?: string
  auto_assign_role?: string
  visible_to_departments?: string[]
  visible_to_roles?: string[]
}

export class UpdateTicketCategoryDto {
  name?: string
  description?: string
  color?: string
  ticket_type_id?: string
  default_sla_days?: number
  auto_assign_user_id?: string
  auto_assign_role?: string
  visible_to_departments?: string[]
  visible_to_roles?: string[]
  is_active?: boolean
}
