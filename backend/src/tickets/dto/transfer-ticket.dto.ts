import { IsOptional, IsString } from 'class-validator'

// Re-routes a ticket to a different resolver group (cross-team / cross-dept).
// Exactly one of resolver_group_id / department_id should be provided; the
// service routes through the target group's assignment strategy.
export class TransferTicketDto {
  @IsOptional()
  @IsString()
  resolver_group_id?: string

  @IsOptional()
  @IsString()
  department_id?: string

  @IsOptional()
  @IsString()
  reason?: string
}
