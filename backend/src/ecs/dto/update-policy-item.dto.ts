import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ContentType } from '@prisma/client';

export class UpdatePolicyItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ContentType)
  content_type?: ContentType;

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
}
