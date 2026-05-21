import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator'
import { HolidayType } from '@prisma/client'

export class CreateIndividualHolidayDto {
  @IsString() name: string
  @IsDateString() date: string
  @IsEnum(HolidayType) type: HolidayType
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsBoolean() is_recurring_yearly?: boolean
}

export class UpdateIndividualHolidayDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsDateString() date?: string
  @IsOptional() @IsEnum(HolidayType) type?: HolidayType
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsBoolean() is_recurring_yearly?: boolean
}

export class CreateIndividualWorkingDaysDto {
  @IsDateString() effective_from: string
  @IsOptional() @IsDateString() effective_to?: string
  working_days: number[]
}

export class UpdateIndividualWorkingDaysDto {
  @IsOptional() @IsDateString() effective_from?: string
  @IsOptional() @IsDateString() effective_to?: string
  @IsOptional() working_days?: number[]
}
