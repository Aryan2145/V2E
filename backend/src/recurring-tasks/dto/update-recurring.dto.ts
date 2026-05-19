import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CompletionMode,
  RecurringEndCondition,
  RecurringScheduleType,
  TaskQuadrant,
} from '@prisma/client';

export class UpdateRecurringDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

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

  @IsOptional()
  @IsEnum(RecurringScheduleType)
  schedule_type?: RecurringScheduleType;

  @IsOptional()
  @IsInt()
  @Min(1)
  every?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  days?: number[];

  @IsOptional()
  @IsInt()
  month_day?: number;

  @IsOptional()
  @IsInt()
  month?: number;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsEnum(RecurringEndCondition)
  end_condition?: RecurringEndCondition;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  end_after?: number;

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
  @IsString()
  department_id?: string;
}
