import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MeetingLinkType } from '@prisma/client';

// ─── Action items ──────────────────────────────────────────────────────────────
export class CreateActionItemDto {
  @IsString() text!: string;
  @IsOptional() @IsUUID() owner_user_id?: string;
  @IsOptional() @IsDateString() due_date?: string;
}

export class UpdateActionItemDto {
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsUUID() owner_user_id?: string | null;
  @IsOptional() @IsDateString() due_date?: string | null;
  @IsOptional() @IsBoolean() is_done?: boolean;
}

/**
 * Link an action item to a task: either attach an existing task (task_id) or
 * create a new one (create). Nothing auto-creates — linking is deliberate.
 */
export class LinkTaskDto {
  @IsOptional() @IsUUID() task_id?: string;

  @IsOptional()
  @IsObject()
  create?: {
    title: string;
    assignee_user_ids: string[];
    deadline?: string;
  };
}

// ─── Decisions ─────────────────────────────────────────────────────────────────
export class CreateDecisionDto {
  @IsString() decision!: string;
  @IsOptional() @IsUUID() owner_user_id?: string;
  @IsOptional() @IsDateString() decided_on?: string;
  @IsOptional() @IsString() @MaxLength(280) reason?: string;
  @IsOptional() @IsEnum(MeetingLinkType) affects_link_type?: MeetingLinkType;
  @IsOptional() @IsString() affects_entity_id?: string;
}

export class UpdateDecisionDto {
  @IsOptional() @IsString() decision?: string;
  @IsOptional() @IsUUID() owner_user_id?: string | null;
  @IsOptional() @IsDateString() decided_on?: string;
  @IsOptional() @IsString() @MaxLength(280) reason?: string;
  @IsOptional() @IsEnum(MeetingLinkType) affects_link_type?: MeetingLinkType | null;
  @IsOptional() @IsString() affects_entity_id?: string | null;
}
