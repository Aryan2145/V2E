import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** A creator-set reminder (see ReminderSpec in ../reminders/reminder-spec.ts). */
export class ReminderSpecDto {
  @IsIn(['relative', 'absolute'])
  kind: 'relative' | 'absolute';

  @IsOptional()
  @IsInt()
  @Min(0)
  offset_days?: number;

  @IsOptional()
  @IsString()
  time?: string; // 'HH:mm'

  @IsOptional()
  @IsDateString()
  remind_at?: string; // ISO instant

  @IsOptional()
  @IsBoolean()
  yearly?: boolean;

  @IsArray()
  @IsIn(['assignee', 'assigner', 'cc'], { each: true })
  recipients: ('assignee' | 'assigner' | 'cc')[];
}
