export class CreateTicketTypeDto {
  name: string
  description?: string
  color: string
  icon: string
  default_sla_days: number
  auto_assign_user_id?: string
  auto_assign_role?: string
  order_index?: number
}

export class UpdateTicketTypeDto {
  name?: string
  description?: string
  color?: string
  icon?: string
  default_sla_days?: number
  auto_assign_user_id?: string
  auto_assign_role?: string
  is_active?: boolean
  order_index?: number
}
