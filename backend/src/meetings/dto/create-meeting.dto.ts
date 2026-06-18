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
import { MeetingLinkType, MeetingMode, MeetingType } from '@prisma/client';

export class SlotInputDto {
  @IsDateString()
  start_at!: string;

  @IsDateString()
  end_at!: string;
}

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

  @IsEnum(MeetingMode)
  mode!: MeetingMode;

  // Linkage — omit both for an ad-hoc meeting.
  @IsOptional()
  @IsEnum(MeetingLinkType)
  link_type?: MeetingLinkType;

  @IsOptional()
  @IsString()
  link_entity_id?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  attendee_user_ids?: string[];

  @IsOptional()
  @IsString()
  agenda?: string;

  @IsOptional()
  @IsString()
  minutes?: string; // captured up-front when logging a past meeting

  // Fixed mode
  @IsOptional()
  @IsDateString()
  scheduled_start?: string;

  @IsOptional()
  @IsDateString()
  scheduled_end?: string;

  // Poll mode
  @IsOptional()
  @IsDateString()
  poll_window_start?: string;

  @IsOptional()
  @IsDateString()
  poll_window_end?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  poll_duration_min?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotInputDto)
  slots?: SlotInputDto[];

  // Log a meeting that already happened → jump to write-up (no invitations).
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
