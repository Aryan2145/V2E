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
import { AnnouncementType, AnnouncementPriority, CommunicationScope } from '@prisma/client';

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @IsOptional()
  @IsEnum(CommunicationScope)
  scope?: CommunicationScope;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;

  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @IsOptional()
  @IsBoolean()
  is_pinned?: boolean;

  @IsOptional()
  @IsArray()
  attachment_urls?: { name: string; url: string }[];
}
