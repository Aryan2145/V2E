import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class CreateTicketPriorityDto {
  @IsString()
  label: string

  @IsString()
  color: string

  @IsOptional()
  @IsInt()
  @Min(0)
  sla_days?: number

  @IsOptional()
  @IsInt()
  order_index?: number
}

export class UpdateTicketPriorityDto {
  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  sla_days?: number

  @IsOptional()
  @IsInt()
  order_index?: number

  @IsOptional()
  @IsBoolean()
  is_active?: boolean
}
