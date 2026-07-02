import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { CompletionMode, TaskQuadrant } from '@prisma/client';
import { CreateScheduleEntryDto } from './create-schedule-entry.dto';
import { ReminderSpecDto } from '../../common/reminders/reminder-spec.dto';

class RecurringChecklistItemDto {
  @IsString()
  title: string;

  @IsNumber()
  order_index: number;

  @IsOptional()
  @IsString()
  group_title?: string;
}

export class CreateRecurringDto {
  @IsString()
  @MaxLength(50)
  title: string;

  @IsOptional()
  @IsString()
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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateScheduleEntryDto)
  schedule_entries: CreateScheduleEntryDto[];

  @IsOptional()
  @IsEnum(CompletionMode)
  completion_mode?: CompletionMode;

  @IsOptional()
  @IsBoolean()
  proof_required?: boolean;

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
  @Type(() => RecurringChecklistItemDto)
  checklist_items?: RecurringChecklistItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReminderSpecDto)
  reminders?: ReminderSpecDto[];

  @IsOptional()
  @IsString()
  department_id?: string;
}
