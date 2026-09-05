import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { GoalStatus } from '@prisma/client';

export class CreateGoalCheckInDto {
  @IsDateString()
  check_in_date!: string;

  /**
   * The owner's traffic light. Validated against the enum here and narrowed to
   * on_track | at_risk | off_track in the service — `achieved` and `closed` are
   * set by hand on the goal, never through a check-in.
   */
  @IsEnum(GoalStatus)
  status!: GoalStatus;

  /** Null/absent when the goal has no target number. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsNumber()
  recorded_value?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  status_note?: string;
}
