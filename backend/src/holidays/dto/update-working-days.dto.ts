import { IsArray, IsInt, Min, Max } from 'class-validator'

export class UpdateWorkingDaysDto {
  @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  working_days: number[]
}
