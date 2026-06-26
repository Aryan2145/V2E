import { IsIn } from 'class-validator'

export class CloseTicketDto {
  @IsIn(['closed_resolved', 'closed_unresolved'])
  status_type: 'closed_resolved' | 'closed_unresolved'
}
