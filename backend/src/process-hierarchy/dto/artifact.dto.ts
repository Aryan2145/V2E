import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ProcessArtifactDirection, ProcessArtifactType } from '@prisma/client';

// File uploads use this (multipart). Title is capped at 50 chars (matches node names).
export class CreateArtifactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ProcessArtifactType)
  artifact_type?: ProcessArtifactType;

  // Files only: false = view-only (previewable, not downloadable). Sent as a string
  // in multipart forms, so accept both.
  @IsOptional()
  allow_download?: boolean | string;
}

// Create a link or article material (no file upload).
export class CreateMaterialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  // 'link' -> url required; 'article' -> content_body required.
  @IsString()
  @IsUrl({ require_protocol: true })
  @IsOptional()
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content_body?: string;
}

export class UpdateArtifactDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ProcessArtifactType)
  artifact_type?: ProcessArtifactType;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content_body?: string;

  @IsOptional()
  @IsBoolean()
  allow_download?: boolean;
}

/** Link a map artifact to a node as an input or output. */
export class LinkArtifactDto {
  @IsUUID()
  artifact_id!: string;

  @IsEnum(ProcessArtifactDirection)
  direction!: ProcessArtifactDirection;
}
