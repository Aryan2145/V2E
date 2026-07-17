import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ProcessConditionKind } from '@prisma/client';

export class CreateConnectionDto {
  @IsOptional()
  @IsUUID()
  parent_node_id?: string | null; // the flow (level) this edge lives in; null = map root

  @IsUUID()
  source_node_id!: string;

  @IsUUID()
  target_node_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsEnum(ProcessConditionKind)
  condition_kind?: ProcessConditionKind;
}

export class UpdateConnectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsEnum(ProcessConditionKind)
  condition_kind?: ProcessConditionKind;
}
