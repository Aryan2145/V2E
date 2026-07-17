import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MeetingLinkType, MeetingType } from '@prisma/client';

export class CreateMeetingDto {
  @IsString()
  @MaxLength(250)
  title!: string;

  @IsEnum(MeetingType)
  type!: MeetingType;

  @IsOptional()
  @IsString()
  online_link?: string;

  @IsOptional()
  @IsString()
  online_password?: string;

  @IsOptional()
  @IsString()
  location?: string;

  // Linkage — omit both for an ad-hoc meeting.
  @IsOptional()
  @IsEnum(MeetingLinkType)
  link_type?: MeetingLinkType;

  @IsOptional()
  @IsString()
  link_entity_id?: string;

  // Everyone here is attending by default (opt-out). No invitations, no accept step.
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  attendee_user_ids?: string[];

  // Subset of attendee_user_ids flagged OPTIONAL (is_required=false). Everyone not
  // listed here is required. Required attendees drive busy-view slot ranking and are
  // the ones governance holds to "declined but required".
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  optional_user_ids?: string[];

  @IsOptional()
  @IsString()
  agenda?: string;

  @IsOptional()
  @IsString()
  minutes?: string; // captured up-front when logging a past meeting

  // The organiser picks the time. The system never sets it.
  @IsOptional()
  @IsDateString()
  scheduled_start?: string;

  @IsOptional()
  @IsDateString()
  scheduled_end?: string;

  // Log a meeting that already happened → jump to write-up (no attendees to notify).
  @IsOptional()
  @IsBoolean()
  log_past?: boolean;

  @IsOptional()
  @IsDateString()
  actual_start?: string;

  @IsOptional()
  @IsDateString()
  actual_end?: string;
}
