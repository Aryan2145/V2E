import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator'
import { HolidayType } from '@prisma/client'

export class CreateDepartmentHolidayDto {
  @IsString() name: string
  @IsDateString() date: string
  @IsEnum(HolidayType) type: HolidayType
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsBoolean() is_recurring_yearly?: boolean
}

export class UpdateDepartmentHolidayDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsDateString() date?: string
  @IsOptional() @IsEnum(HolidayType) type?: HolidayType
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsBoolean() is_recurring_yearly?: boolean
}
