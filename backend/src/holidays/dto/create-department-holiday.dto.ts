import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString, IsArray } from 'class-validator'
import { HolidayType } from '@prisma/client'

export class CreateDepartmentHolidayDto {
  @IsString() name: string
  @IsDateString() date: string
  /** Optional inclusive end date — when set (and after `date`), the holiday spans a range. */
  @IsOptional() @IsDateString() end_date?: string
  @IsEnum(HolidayType) type: HolidayType
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsBoolean() is_recurring_yearly?: boolean
  /**
   * Cascade reach: the checked descendant department ids the holiday applies to.
   * Empty/omitted = this department only. Subtree semantics are expanded by the
   * client; the server stores exactly what it receives (validated as descendants).
   */
  @IsOptional() @IsArray() @IsString({ each: true }) target_department_ids?: string[]
}

export class UpdateDepartmentHolidayDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsDateString() date?: string
  @IsOptional() @IsDateString() end_date?: string
  @IsOptional() @IsEnum(HolidayType) type?: HolidayType
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsBoolean() is_recurring_yearly?: boolean
  /** When provided, replaces the cascade reach wholesale. Omit to leave unchanged. */
  @IsOptional() @IsArray() @IsString({ each: true }) target_department_ids?: string[]
}
