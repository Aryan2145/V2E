import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CompletionMode, TaskQuadrant } from '@prisma/client';
import { CreateScheduleEntryDto } from './create-schedule-entry.dto';
import { RecurringChecklistItemDto } from './create-recurring.dto';
import { ReminderSpecDto } from '../../common/reminders/reminder-spec.dto';

export class UpdateRecurringDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskQuadrant)
  quadrant?: TaskQuadrant;

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsString()
  priority_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScheduleEntryDto)
  schedule_entries?: CreateScheduleEntryDto[];

  @IsOptional()
  @IsEnum(CompletionMode)
  completion_mode?: CompletionMode;

  @IsOptional()
  @IsBoolean()
  proof_required?: boolean;

  // Allowed proof file extensions (empty = any type); applies to future instances.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  proof_allowed_extensions?: string[];

  // Ordered escalation contacts — level = position + 1 on each spawned instance.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  escalation_user_ids?: string[];

  // Links every future instance to a quarterly goal. Empty string clears the link.
  @IsOptional()
  @IsString()
  linked_goal_id?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignee_user_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cc_user_ids?: string[];

  // Full replacement of the template's checklist definition (future instances only).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecurringChecklistItemDto)
  checklist_items?: RecurringChecklistItemDto[];

  // Full replacement of the template's reminder specs (future instances only).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReminderSpecDto)
  reminders?: ReminderSpecDto[];

  @IsOptional()
  @IsString()
  department_id?: string;
}
