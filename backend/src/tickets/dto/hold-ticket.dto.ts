import { IsOptional, IsString } from 'class-validator'

export class HoldTicketDto {
  // Why the ticket is being parked (waiting on requester, vendor, parts, etc.).
  @IsOptional()
  @IsString()
  reason?: string
}
