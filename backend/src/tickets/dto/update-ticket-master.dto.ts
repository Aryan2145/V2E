import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'
import { TicketReassignmentMode } from '@prisma/client'

export class UpdateTicketMasterDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ticket_creation_roles?: string[]

  @IsOptional()
  @IsEnum(TicketReassignmentMode)
  reassignment_mode?: TicketReassignmentMode

  @IsOptional()
  @IsBoolean()
  require_raiser_confirmation?: boolean

  @IsOptional()
  @IsBoolean()
  enable_rating?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  default_escalation_levels?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  default_response_sla_hours?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  escalation_interval_hours?: number

  @IsOptional()
  @IsBoolean()
  allow_requester_reopen?: boolean

  @IsOptional()
  @IsBoolean()
  allow_assignee_reopen?: boolean
}
