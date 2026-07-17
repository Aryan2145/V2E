import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MeetingLinkType,
  MeetingType,
  RecurringEndCondition,
  RecurringScheduleType,
} from '@prisma/client';

// ─── Header edit / delete ──────────────────────────────────────────────────────
export class UpdateMeetingDto {
  @IsOptional() @IsString() @MaxLength(250) title?: string;
  @IsOptional() @IsEnum(MeetingType) type?: MeetingType;
  @IsOptional() @IsString() online_link?: string;
  @IsOptional() @IsString() online_password?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsEnum(MeetingLinkType) link_type?: MeetingLinkType | null;
  @IsOptional() @IsString() link_entity_id?: string | null;
  @IsOptional() @IsDateString() scheduled_start?: string;
  @IsOptional() @IsDateString() scheduled_end?: string;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) attendee_user_ids?: string[];
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) optional_user_ids?: string[];
}

export class DeleteMeetingDto {
  @IsOptional() @IsString() reason?: string;
}

// ─── Shared record (agenda + minutes, markdown) ────────────────────────────────
export class UpdateRecordDto {
  @IsOptional() @IsString() agenda?: string;
  @IsOptional() @IsString() minutes?: string;
}

// ─── Attendance response — opt-out: the ONLY action is to decline (with a reason).
// "Attending" is the default and needs no action. There is no accept, no reschedule.
export class DeclineDto {
  @IsString() @MaxLength(1000) reason!: string; // required — an absence always leaves a reason
}

// Undo one's own decline (back to attending). Does not touch anyone else's row.
export class UndoDeclineDto {}

// ─── Time capture / attendance ─────────────────────────────────────────────────
export class AttendanceRowDto {
  @IsUUID() user_id!: string;
  @IsBoolean() attended!: boolean;
  @IsOptional() @IsDateString() attended_in_at?: string;
  @IsOptional() @IsDateString() attended_out_at?: string;
}

export class MarkAttendanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRowDto)
  rows!: AttendanceRowDto[];
}

// ─── Private note ──────────────────────────────────────────────────────────────
export class PrivateNoteDto {
  @IsString() body!: string;
}

// ─── Busy view (organiser sees busy times before picking a slot) ───────────────
export class BusyQueryDto {
  @IsArray() @IsUUID('all', { each: true }) user_ids!: string[];
  // Subset of user_ids that are required. A clash with a required attendee is a HARD
  // conflict that drives slot ranking; an optional attendee's clash is a soft warning.
  // Omitted → everyone is treated as required.
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) required_user_ids?: string[];
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  // When set, the response includes ranked suggestion slots of this length.
  @IsOptional() @IsInt() @Min(5) duration_min?: number;
}

// ─── Rhythms (recurring meetings) ──────────────────────────────────────────────
export class RhythmScheduleDto {
  @IsEnum(RecurringScheduleType) schedule_type!: RecurringScheduleType;
  @IsOptional() @IsInt() @Min(1) every?: number;
  @IsOptional() @IsArray() days?: number[];
  @IsOptional() @IsArray() month_days?: number[];
  @IsOptional() @IsArray() yearly_dates?: { month: number; day: number }[];
  @IsString() time!: string; // "HH:mm"
  @IsDateString() start_date!: string;
  @IsOptional() @IsEnum(RecurringEndCondition) end_condition?: RecurringEndCondition;
  @IsOptional() @IsDateString() end_date?: string;
  @IsOptional() @IsInt() @Min(1) end_after?: number;
}

export class CreateRhythmDto {
  @IsString() @MaxLength(250) title!: string;
  @IsEnum(MeetingType) type!: MeetingType;
  @IsOptional() @IsString() online_link?: string;
  @IsOptional() @IsString() online_password?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsEnum(MeetingLinkType) link_type?: MeetingLinkType;
  @IsOptional() @IsString() link_entity_id?: string;
  @IsOptional() @IsString() agenda?: string;
  @IsInt() @Min(5) duration_min!: number;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) attendee_user_ids?: string[];
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) optional_user_ids?: string[];
  @ValidateNested() @Type(() => RhythmScheduleDto) schedule!: RhythmScheduleDto;
}

export class UpdateRhythmDto {
  @IsOptional() @IsString() @MaxLength(250) title?: string;
  @IsOptional() @IsEnum(MeetingType) type?: MeetingType;
  @IsOptional() @IsString() online_link?: string;
  @IsOptional() @IsString() online_password?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsEnum(MeetingLinkType) link_type?: MeetingLinkType | null;
  @IsOptional() @IsString() link_entity_id?: string | null;
  @IsOptional() @IsString() agenda?: string;
  @IsOptional() @IsInt() @Min(5) duration_min?: number;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) attendee_user_ids?: string[];
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) optional_user_ids?: string[];
  @IsOptional() @ValidateNested() @Type(() => RhythmScheduleDto) schedule?: RhythmScheduleDto;
}
