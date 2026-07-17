import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ProcessArtifactDirection, ProcessArtifactType } from '@prisma/client';

export class CreateArtifactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ProcessArtifactType)
  artifact_type?: ProcessArtifactType;
}

export class UpdateArtifactDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ProcessArtifactType)
  artifact_type?: ProcessArtifactType;
}

/** Link a map artifact to a node as an input or output. */
export class LinkArtifactDto {
  @IsUUID()
  artifact_id!: string;

  @IsEnum(ProcessArtifactDirection)
  direction!: ProcessArtifactDirection;
}
