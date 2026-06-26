import { IsString } from 'class-validator'

export class RejectTicketDto {
  // Required: why this ticket is being bounced back to triage.
  @IsString()
  reason: string
}
