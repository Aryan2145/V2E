import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'
import { TicketAssignmentStrategy } from '@prisma/client'

export class CreateResolverGroupDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  department_id?: string

  @IsOptional()
  @IsEnum(TicketAssignmentStrategy)
  assignment_strategy?: TicketAssignmentStrategy

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  member_user_ids?: string[]
}

export class UpdateResolverGroupDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  department_id?: string

  @IsOptional()
  @IsEnum(TicketAssignmentStrategy)
  assignment_strategy?: TicketAssignmentStrategy

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  member_user_ids?: string[]

  @IsOptional()
  @IsBoolean()
  is_active?: boolean
}
