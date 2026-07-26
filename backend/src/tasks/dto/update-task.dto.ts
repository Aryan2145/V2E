import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CompletionMode, TaskQuadrant, TaskType } from '@prisma/client';

// One checklist item in an edit payload. `id` is present for an item that already
// exists on the task — the backend matches on it to preserve that item's per-person
// progress (ticks/skips). Absent id = a brand-new item.
class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  title: string;

  @IsNumber()
  order_index: number;

  @IsOptional()
  @IsString()
  group_title?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
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

  // Restrict proof uploads to these file extensions (lowercase, no dot). Empty = any.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  proof_allowed_extensions?: string[];

  @IsOptional()
  @IsDateString()
  deadline?: string;

  // The user saw the "deadline falls on a holiday / non-working day" warning and
  // explicitly chose to keep the date — the system never forces the holiday rule.
  @IsOptional()
  @IsBoolean()
  holiday_override?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignee_user_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cc_user_ids?: string[];

  // Re-link (or unlink) this task to a quarterly goal.
  @IsOptional()
  @IsString()
  goal_id?: string;

  // Full, authoritative checklist for the task. When present, the backend reconciles
  // the existing checklist to match: items keyed by `id` are kept (title/order/group
  // updated in place, per-person progress preserved), items whose id disappears are
  // deleted, and items without an id are created fresh. An empty array clears it.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateChecklistItemDto)
  checklist_items?: UpdateChecklistItemDto[];

  // Template ids newly applied in this edit — re-validated for access, mirroring create.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  checklist_template_ids?: string[];
}
