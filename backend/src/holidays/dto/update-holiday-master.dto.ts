import { IsString, IsOptional, IsEnum, IsInt, IsBoolean, IsArray, Min } from 'class-validator'
import { HolidayOnTaskAction, HolidayPriorityLevel } from '@prisma/client'

export class UpdateHolidayMasterDto {
  @IsOptional() @IsString() country_code?: string | null
  @IsOptional() @IsEnum(HolidayOnTaskAction) holiday_on_task_action?: HolidayOnTaskAction
  @IsOptional() @IsEnum(HolidayPriorityLevel) priority_level?: HolidayPriorityLevel
  @IsOptional() @IsInt() @Min(1) pending_review_deadline_days?: number
  @IsOptional() @IsBoolean() auto_apply_if_not_reviewed?: boolean
  @IsOptional() @IsArray() @IsString({ each: true }) org_holiday_manage_roles?: string[]
  @IsOptional() @IsArray() @IsString({ each: true }) dept_holiday_manage_roles?: string[]
  @IsOptional() @IsArray() @IsString({ each: true }) individual_holiday_manage_roles?: string[]
}
