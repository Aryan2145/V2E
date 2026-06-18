import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GoalStatus } from '@prisma/client';
import { GoalMeasureDto } from './create-goal.dto';

/**
 * level, parent_goal_id and perspective are intentionally immutable — the cascade
 * and the "perspective set once on the annual" rule must not be re-picked.
 */
export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  owner_user_id?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoalMeasureDto)
  measures?: GoalMeasureDto[];
}

export class DeleteGoalDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
