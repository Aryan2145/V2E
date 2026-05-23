import { IsString, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class TemplateChecklistItemDto {
  @IsString()
  title: string;
}

class TemplateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  priority_id?: string;

  @IsOptional()
  @IsNumber()
  estimated_days?: number;

  @IsOptional()
  @IsString()
  default_assignee_user_id?: string;

  @IsOptional()
  @IsString()
  default_assignee_role?: string;

  @IsOptional()
  @IsNumber()
  order_index?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateChecklistItemDto)
  checklist_items?: TemplateChecklistItemDto[];
}

class TemplateMilestoneDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  order_index?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateTaskDto)
  tasks?: TemplateTaskDto[];
}

export class CreateProjectTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateMilestoneDto)
  milestones?: TemplateMilestoneDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateTaskDto)
  tasks?: TemplateTaskDto[];
}
