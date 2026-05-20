export class CreateTicketPriorityDto {
  label: string
  color: string
  sla_days?: number
  order_index?: number
}

export class UpdateTicketPriorityDto {
  label?: string
  color?: string
  sla_days?: number
  order_index?: number
  is_active?: boolean
}
