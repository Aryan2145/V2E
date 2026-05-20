export class CreateTicketStatusDto {
  label: string
  type: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed_resolved' | 'closed_unresolved'
  color: string
  order_index?: number
  is_default?: boolean
}

export class UpdateTicketStatusDto {
  label?: string
  color?: string
  order_index?: number
  is_default?: boolean
  is_active?: boolean
}

export class ReorderTicketStatusesDto {
  items: { id: string; order_index: number }[]
}
