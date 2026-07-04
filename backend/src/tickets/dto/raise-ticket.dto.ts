import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator'
import { Type } from 'class-transformer'

class RaiseChecklistItemDto {
  @IsString()
  title: string
}

export class RaiseTicketDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsString()
  ticket_type_id: string

  @IsOptional()
  @IsString()
  category_id?: string

  @IsOptional()
  @IsString()
  priority_id?: string

  @IsOptional()
  @IsString()
  template_id?: string

  @IsOptional()
  @IsString()
  assigned_to_user_id?: string

  @IsOptional()
  @IsBoolean()
  proof_required?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RaiseChecklistItemDto)
  checklist_items?: RaiseChecklistItemDto[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  escalation_user_ids?: string[]
}
