import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ContentType } from '@prisma/client';

export class CreatePolicyItemDto {
  @IsString()
  @IsNotEmpty()
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
}
