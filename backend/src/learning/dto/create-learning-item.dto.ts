import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ContentType } from '@prisma/client';

export class CreateLearningItemDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(ContentType)
  content_type: ContentType;

  // Only http(s) links — blocks javascript:/data: XSS vectors. Empty/omitted is fine
  // (file/article items have no url). Non-empty values must be a valid http(s) URL.
  @ValidateIf((o) => typeof o.content_url === 'string' && o.content_url.length > 0)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  content_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
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

  // For url items: embed the page inline (vs open in a new tab).
  @IsOptional()
  @IsBoolean()
  embed_inline?: boolean;
}
