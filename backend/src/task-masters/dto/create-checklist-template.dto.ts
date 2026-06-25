import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TemplateItemDto {
  @IsString()
  title: string;

  @IsOptional()
  order_index?: number;
}

export enum ChecklistAccessMode {
  everyone = 'everyone',
  restricted = 'restricted',
}

export enum ChecklistAccessKind {
  department = 'department',
  role = 'role',
  user = 'user',
  exclude_user = 'exclude_user',
  exclude_role = 'exclude_role',
}

class AccessRuleDto {
  @IsEnum(ChecklistAccessKind)
  kind: ChecklistAccessKind;

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsBoolean()
  include_sub_departments?: boolean;

  @IsOptional()
  @IsString()
  role_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;
}

export class CreateChecklistTemplateDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items?: TemplateItemDto[];

  @IsOptional()
  @IsEnum(ChecklistAccessMode)
  access_mode?: ChecklistAccessMode;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccessRuleDto)
  access_rules?: AccessRuleDto[];
}
