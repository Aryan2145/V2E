import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class CreateTicketCategoryDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsString()
  color: string

  @IsOptional()
  @IsString()
  ticket_type_id?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  default_sla_days?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  default_response_sla_hours?: number

  @IsOptional()
  @IsString()
  auto_assign_user_id?: string

  @IsOptional()
  @IsString()
  auto_assign_role?: string

  @IsOptional()
  @IsString()
  resolver_group_id?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visible_to_departments?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visible_to_roles?: string[]
}

export class UpdateTicketCategoryDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsString()
  ticket_type_id?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  default_sla_days?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  default_response_sla_hours?: number

  @IsOptional()
  @IsString()
  auto_assign_user_id?: string

  @IsOptional()
  @IsString()
  auto_assign_role?: string

  @IsOptional()
  @IsString()
  resolver_group_id?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visible_to_departments?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visible_to_roles?: string[]

  @IsOptional()
  @IsBoolean()
  is_active?: boolean
}
