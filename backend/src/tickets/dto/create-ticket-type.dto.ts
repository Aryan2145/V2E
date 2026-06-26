import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class CreateTicketTypeDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsString()
  color: string

  @IsString()
  icon: string

  @IsInt()
  @Min(0)
  default_sla_days: number

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
  @IsInt()
  order_index?: number
}

export class UpdateTicketTypeDto {
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
  icon?: string

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
  @IsBoolean()
  is_active?: boolean

  @IsOptional()
  @IsInt()
  order_index?: number
}
