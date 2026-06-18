import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MeetingLinkType, MeetingType, MeetingVote } from '@prisma/client';

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
}

export class DeleteMeetingDto {
  @IsOptional() @IsString() reason?: string;
}

// ─── Shared record (agenda + minutes, markdown) ────────────────────────────────
export class UpdateRecordDto {
  @IsOptional() @IsString() agenda?: string;
  @IsOptional() @IsString() minutes?: string;
}

// ─── Fixed-mode invite response ────────────────────────────────────────────────
export class RespondDto {
  @IsEnum(['accept', 'reject', 'reschedule'])
  action!: 'accept' | 'reject' | 'reschedule';

  @IsOptional() @IsString() reason?: string; // required when reject
  @IsOptional() @IsDateString() reschedule_at?: string; // required when reschedule
  @IsOptional() @IsString() reschedule_note?: string;
}

// ─── Poll slots ────────────────────────────────────────────────────────────────
export class AddSlotDto {
  @IsDateString() start_at!: string;
  @IsDateString() end_at!: string;
}

export class VoteSlotDto {
  @IsEnum(MeetingVote) vote!: MeetingVote;
}

export class ConfirmSlotDto {
  @IsUUID() slot_id!: string;
}

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
