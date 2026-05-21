import { IsInt, IsArray, ValidateNested, IsString, IsBoolean, IsOptional } from 'class-validator'
import { Type } from 'class-transformer'

export class NagerHolidayDto {
  @IsString() date: string
  @IsString() name: string
  @IsString() localName: string
  @IsString() countryCode: string
  @IsBoolean() global: boolean
  @IsArray() @IsString({ each: true }) types: string[]
}

export class ImportNationalHolidaysDto {
  @IsInt() year: number
  @IsArray() @ValidateNested({ each: true }) @Type(() => NagerHolidayDto)
  holidays: NagerHolidayDto[]
}

export class ApplyPendingHolidaysDto {
  @IsInt() year: number
  @IsOptional() @IsArray() @IsString({ each: true }) holiday_ids?: string[]
}
