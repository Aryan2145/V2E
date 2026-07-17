import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ProcessSnapshotStatus } from '@prisma/client';

export class CreateSnapshotDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsEnum(ProcessSnapshotStatus)
  status?: ProcessSnapshotStatus;
}
