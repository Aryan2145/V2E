import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { TicketTemplateType, TicketTemplateAccessMode, TicketTemplateAccessKind } from '@prisma/client'

class TemplateChecklistItemDto {
  @IsString()
  title: string
}

// Mirrors the checklist-template AccessRuleDto.
export class TicketTemplateAccessRuleDto {
  @IsEnum(TicketTemplateAccessKind)
  kind: TicketTemplateAccessKind

  @IsOptional()
  @IsString()
  department_id?: string

  @IsOptional()
  @IsBoolean()
  include_sub_departments?: boolean

  @IsOptional()
  @IsString()
  role_id?: string

  @IsOptional()
  @IsString()
  user_id?: string
}

export class CreateTicketTemplateDto {
  @IsString()
  name: string

  @IsOptional()
  @IsEnum(TicketTemplateType)
  template_type?: TicketTemplateType

  @IsOptional()
  @IsString()
  ticket_type_id?: string

  @IsOptional()
  @IsString()
  category_id?: string

  @IsOptional()
  @IsString()
  priority_id?: string

  @IsOptional()
  @IsString()
  resolver_group_id?: string

  @IsOptional()
  @IsString()
  department_id?: string

  @IsOptional()
  @IsString()
  group_label?: string

  @IsString()
  title_template: string

  @IsOptional()
  @IsString()
  description_template?: string

  @IsOptional()
  @IsString()
  auto_assign_user_id?: string

  @IsOptional()
  @IsString()
  auto_assign_role?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  sla_days?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  response_sla_hours?: number

  @IsOptional()
  @IsBoolean()
  lock_priority?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateChecklistItemDto)
  checklist_items?: TemplateChecklistItemDto[]

  @IsOptional()
  @IsEnum(TicketTemplateAccessMode)
  access_mode?: TicketTemplateAccessMode

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketTemplateAccessRuleDto)
  access_rules?: TicketTemplateAccessRuleDto[]
}

export class UpdateTicketTemplateDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsEnum(TicketTemplateType)
  template_type?: TicketTemplateType

  @IsOptional()
  @IsString()
  ticket_type_id?: string

  @IsOptional()
  @IsString()
  category_id?: string

  @IsOptional()
  @IsString()
  priority_id?: string

  @IsOptional()
  @IsString()
  resolver_group_id?: string

  @IsOptional()
  @IsString()
  department_id?: string

  @IsOptional()
  @IsString()
  group_label?: string

  @IsOptional()
  @IsString()
  title_template?: string

  @IsOptional()
  @IsString()
  description_template?: string

  @IsOptional()
  @IsString()
  auto_assign_user_id?: string

  @IsOptional()
  @IsString()
  auto_assign_role?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  sla_days?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  response_sla_hours?: number

  @IsOptional()
  @IsBoolean()
  lock_priority?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateChecklistItemDto)
  checklist_items?: TemplateChecklistItemDto[]

  @IsOptional()
  @IsEnum(TicketTemplateAccessMode)
  access_mode?: TicketTemplateAccessMode

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketTemplateAccessRuleDto)
  access_rules?: TicketTemplateAccessRuleDto[]

  @IsOptional()
  @IsBoolean()
  is_active?: boolean
}
