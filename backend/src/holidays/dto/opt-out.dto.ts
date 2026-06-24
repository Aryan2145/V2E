import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { HolidayOptOutSource } from '@prisma/client'

/** A department removes one or more org holidays. */
export class OptOutOrgHolidaysDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  org_holiday_ids: string[]

  /**
   * The remover's reach choice: false suppresses only this department; true cascades to
   * all of its sub-departments (and they cannot re-add it). Defaults to true.
   */
  @IsOptional() @IsBoolean()
  applies_to_subtree?: boolean
}

/** A department re-enforces (restores) one or more removed org holidays. */
export class UndoOptOutOrgHolidaysDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  org_holiday_ids: string[]
}

/** One inherited holiday an employee is removing/restoring, identified by source + id. */
export class UserHolidayOptOutItemDto {
  @IsEnum(HolidayOptOutSource)
  holiday_source: HolidayOptOutSource

  @IsString()
  holiday_id: string
}

/** An employee removes/restores one or more inherited holidays. */
export class OptOutUserHolidaysDto {
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => UserHolidayOptOutItemDto)
  items: UserHolidayOptOutItemDto[]
}
