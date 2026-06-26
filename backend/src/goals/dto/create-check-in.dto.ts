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
import { GoalConfidence } from '@prisma/client';

export class MeasureValueDto {
  @IsUUID()
  goal_measure_id!: string;

  @IsString()
  @MaxLength(100)
  value!: string;
}

export class CreateGoalCheckInDto {
  @IsDateString()
  check_in_date!: string;

  @IsEnum(GoalConfidence)
  confidence!: GoalConfidence;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  status_note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeasureValueDto)
  values?: MeasureValueDto[];
}
