import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { TicketStatusType } from '@prisma/client'

export class CreateTicketStatusDto {
  @IsString()
  label: string

  @IsEnum(TicketStatusType)
  type: TicketStatusType

  @IsString()
  color: string

  @IsOptional()
  @IsInt()
  order_index?: number

  @IsOptional()
  @IsBoolean()
  is_default?: boolean
}

export class UpdateTicketStatusDto {
  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsInt()
  order_index?: number

  @IsOptional()
  @IsBoolean()
  is_default?: boolean

  @IsOptional()
  @IsBoolean()
  is_active?: boolean
}

class ReorderStatusItemDto {
  @IsString()
  id: string

  @IsInt()
  order_index: number
}

export class ReorderTicketStatusesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderStatusItemDto)
  items: ReorderStatusItemDto[]
}
