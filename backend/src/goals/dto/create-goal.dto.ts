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
import { GoalCadence, GoalLevel, GoalPerspective, GoalStatus } from '@prisma/client';

export class GoalMeasureDto {
  // Present when editing an existing measure — lets the service preserve its
  // identity (and check-in history) instead of wiping and recreating.
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(100)
  target_value!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  current_value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;
}

export class CreateGoalDto {
  @IsEnum(GoalLevel)
  level!: GoalLevel;

  @IsOptional()
  @IsUUID()
  parent_goal_id?: string; // required for annual/quarterly, null for objective (validated in service)

  @IsOptional()
  @IsEnum(GoalPerspective)
  perspective?: GoalPerspective; // required for annual; for quarterly defaults to the parent's; ignored for objective

  @IsString()
  @MaxLength(250)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  owner_user_id!: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsDateString()
  due_date!: string;

  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @IsOptional()
  @IsEnum(GoalCadence)
  review_cadence?: GoalCadence;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoalMeasureDto)
  measures?: GoalMeasureDto[];
}
