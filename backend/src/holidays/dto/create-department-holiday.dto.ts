import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator'
import { HolidayType } from '@prisma/client'

export class CreateDepartmentHolidayDto {
  @IsString() name: string
  @IsDateString() date: string
  /** Optional inclusive end date — when set (and after `date`), the holiday spans a range. */
  @IsOptional() @IsDateString() end_date?: string
  @IsEnum(HolidayType) type: HolidayType
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsBoolean() is_recurring_yearly?: boolean
}

export class UpdateDepartmentHolidayDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsDateString() date?: string
  @IsOptional() @IsDateString() end_date?: string
  @IsOptional() @IsEnum(HolidayType) type?: HolidayType
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsBoolean() is_recurring_yearly?: boolean
}
