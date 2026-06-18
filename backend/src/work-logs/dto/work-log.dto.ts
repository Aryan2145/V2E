import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RecurringEndCondition, RecurringScheduleType } from '@prisma/client';

// ─── Daily Update ────────────────────────────────────────────────────────────

export class WorkLogNoteDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  order_index?: number;
}

export class FoldedSubmissionDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  body?: string;
}

export class UpsertDailyUpdateDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkLogNoteDto)
  notes?: WorkLogNoteDto[];

  @IsOptional()
  @IsString()
  stuck?: string;

  @IsOptional()
  @IsString()
  decisions?: string;

  @IsOptional()
  @IsString()
  day_summary?: string;

  @IsOptional()
  @IsString()
  planning_tomorrow?: string;

  /** Bodies for daily-frequency demanded logs folded into this day. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FoldedSubmissionDto)
  folded_submissions?: FoldedSubmissionDto[];

  /** When true, marks the day (and folded submissions) as submitted. */
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

// ─── Demands (mirror of recurring schedule entry) ──────────────────────────────

export class WorkLogYearlyDateDto {
  @IsInt() @Min(1) month: number;
  @IsInt() @Min(1) day: number;
}

export class WorkLogScheduleEntryDto {
  @IsEnum(RecurringScheduleType)
  schedule_type: RecurringScheduleType;

  @IsOptional() @IsInt() @Min(1)
  every?: number;

  @IsOptional() @IsArray()
  days?: number[];

  @IsOptional() @IsArray()
  month_days?: number[];

  @IsOptional() @IsArray()
  @ValidateNested({ each: true }) @Type(() => WorkLogYearlyDateDto)
  yearly_dates?: WorkLogYearlyDateDto[];

  @IsString()
  time: string;

  @IsDateString()
  start_date: string;

  @IsOptional() @IsEnum(RecurringEndCondition)
  end_condition?: RecurringEndCondition;

  @IsOptional() @IsDateString()
  end_date?: string;

  @IsOptional() @IsInt() @Min(1)
  end_after?: number;

  @IsOptional() @IsInt()
  order_index?: number;
}

export class CreateDemandDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  assignee_user_id: string;

  @IsIn(['one_time', 'recurring'])
  kind: 'one_time' | 'recurring';

  /** one_time only */
  @IsOptional()
  @IsDateString()
  deadline?: string;

  /** recurring only — at least one entry */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkLogScheduleEntryDto)
  schedule_entries?: WorkLogScheduleEntryDto[];
}

export class SubmitSubmissionDto {
  @IsOptional()
  @IsString()
  body?: string;
}

// ─── Remarks ───────────────────────────────────────────────────────────────────

export class CreateRemarkDto {
  @IsIn(['daily_update', 'submission'])
  target_type: 'daily_update' | 'submission';

  @IsString()
  target_id: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  reply_to_remark_id?: string;

  @IsOptional()
  @IsArray()
  attachment_urls?: { name: string; url: string }[];
}

// ─── Admin access ────────────────────────────────────────────────────────────

export class UpdateAccessSettingsDto {
  @IsOptional()
  @IsBoolean()
  managers_read_reports?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  writer_user_ids?: string[];
}

export class CreateReaderGrantDto {
  @IsString()
  reader_user_id: string;

  @IsString()
  writer_user_id: string;
}
