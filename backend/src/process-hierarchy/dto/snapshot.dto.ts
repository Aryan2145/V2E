import { IsDefined, IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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

// Undo/redo restore: the whole serialized map state the client captured. Left as a free-form
// object (its inner shape is validated in the service; org/map are clamped there too).
export class RestoreStateDto {
  @IsDefined()
  @IsObject()
  tree_json!: any;
}
