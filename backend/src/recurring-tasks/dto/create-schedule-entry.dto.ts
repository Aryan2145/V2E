import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecurringEndCondition, RecurringScheduleType } from '@prisma/client';

export class YearlyDateDto {
  @IsInt()
  @Min(1)
  month: number;

  @IsInt()
  @Min(1)
  day: number;
}

export class CreateScheduleEntryDto {
  @IsEnum(RecurringScheduleType)
  schedule_type: RecurringScheduleType;

  @IsOptional()
  @IsInt()
  @Min(1)
  every?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  days?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  month_days?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => YearlyDateDto)
  yearly_dates?: YearlyDateDto[];

  @IsString()
  time: string;

  @IsDateString()
  start_date: string;

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
  @IsInt()
  order_index?: number;
}
