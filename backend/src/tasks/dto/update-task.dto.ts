import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CompletionMode, TaskQuadrant, TaskType } from '@prisma/client';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  title?: string;

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

  // Re-link (or unlink) this task to a quarterly goal.
  @IsOptional()
  @IsString()
  goal_id?: string;
}
