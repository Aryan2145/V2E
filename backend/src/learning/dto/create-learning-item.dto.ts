import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { ContentType } from '@prisma/client';

export class CreateLearningItemDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ContentType)
  content_type: ContentType;

  @IsOptional()
  @IsString()
  content_url?: string;

  @IsOptional()
  @IsString()
  content_body?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order_index?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimated_minutes?: number;

  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  // Per-material download toggle for file items (course-decider's choice).
  @IsOptional()
  @IsBoolean()
  allow_download?: boolean;
}
