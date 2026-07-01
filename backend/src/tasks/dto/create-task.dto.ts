import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CompletionMode, TaskQuadrant, TaskType } from '@prisma/client';

class ChecklistItemDto {
  @IsString()
  title: string;

  @IsNumber()
  order_index: number;

  // Section label when the task carries multiple checklists (template + custom, etc.).
  @IsOptional()
  @IsString()
  group_title?: string;
}

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsString()
  priority_id?: string;

  @IsOptional()
  @IsString()
  status_id?: string;

  @IsOptional()
  @IsEnum(TaskQuadrant)
  quadrant?: TaskQuadrant;

  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsEnum(CompletionMode)
  completion_mode?: CompletionMode;

  @IsOptional()
  @IsBoolean()
  proof_required?: boolean;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignee_user_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cc_user_ids?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist_items?: ChecklistItemDto[];

  // When the checklist was applied from a template, its id — re-validated for access.
  @IsOptional()
  @IsString()
  checklist_template_id?: string;

  // When multiple template-sourced checklists are attached, every applied
  // template id — each re-validated for access alongside checklist_template_id.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  checklist_template_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  escalation_user_ids?: string[];

  // Links this task as an initiative under a QUARTERLY goal.
  @IsOptional()
  @IsString()
  goal_id?: string;
}
