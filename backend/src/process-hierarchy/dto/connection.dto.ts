import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ProcessConditionKind } from '@prisma/client';

const SIDES = ['right', 'bottom', 'top', 'left'];

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

  // Swimlane: which dot of the source the line leaves from (what the user dragged from).
  @IsOptional()
  @IsIn(SIDES)
  source_side?: string;

  // Which dot of the target the line enters (what the user dropped on).
  @IsOptional()
  @IsIn(SIDES)
  target_side?: string;
}

export class UpdateConnectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsEnum(ProcessConditionKind)
  condition_kind?: ProcessConditionKind;

  // Re-drag either end of a line to a different dot → update the stored sides.
  @IsOptional()
  @IsIn(SIDES)
  source_side?: string;

  @IsOptional()
  @IsIn(SIDES)
  target_side?: string;
}
