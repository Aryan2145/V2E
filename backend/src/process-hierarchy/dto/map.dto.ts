import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateMapDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  // Build a map nested under another (an area inside a bigger map). Omit = top level.
  @IsOptional()
  @IsUUID()
  parent_map_id?: string | null;
}

export class UpdateMapDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  // Move the map in the tree (null = top level). Cycle-checked in the service.
  @IsOptional()
  parent_map_id?: string | null;

  @IsOptional()
  @IsBoolean()
  is_pinned?: boolean;
}
