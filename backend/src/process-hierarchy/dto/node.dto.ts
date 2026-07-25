import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ProcessNodeKind, ProcessNodeStatus } from '@prisma/client';

export class ChecklistItemInput {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;
}

export class CreateNodeDto {
  @IsOptional()
  @IsUUID()
  parent_node_id?: string | null; // null / omitted = top level of the map

  @IsEnum(ProcessNodeKind)
  kind!: ProcessNodeKind;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsNumber()
  position_x?: number;

  @IsOptional()
  @IsNumber()
  position_y?: number;

  // Composition: for a container/sub-process, also create a child map and reference it
  // (build-in-place — the area instantly becomes its own reusable map).
  @IsOptional()
  @IsBoolean()
  create_linked_map?: boolean;

  // Insert a reference to an EXISTING map instead (an instance of that map).
  @IsOptional()
  @IsUUID()
  linked_map_id?: string;
}

export class UpdateNodeDto {
  // Convert this node to another type. The service enforces which conversions are
  // safe (e.g. an area with contents cannot become a single step).
  @IsOptional()
  @IsEnum(ProcessNodeKind)
  kind?: ProcessNodeKind;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsEnum(ProcessNodeStatus)
  status?: ProcessNodeStatus;

  @IsOptional()
  @IsUUID()
  responsible_role_id?: string | null;

  @IsOptional()
  @IsUUID()
  responsible_user_id?: string | null;

  @IsOptional()
  @IsNumber()
  position_x?: number;

  @IsOptional()
  @IsNumber()
  position_y?: number;

  // Cross-map link: drilling this node opens another map (null to unlink).
  @IsOptional()
  @IsUUID()
  linked_map_id?: string | null;

  // Re-parent (move) the node to a different container/level within the same map.
  // null = move to the map's top level. Validated for cycles in the service.
  @IsOptional()
  @ValidateIf((o) => o.parent_node_id !== null)
  @IsUUID()
  parent_node_id?: string | null;

  // Replace-all checklist (send the full desired list; omit to leave unchanged).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemInput)
  checklist?: ChecklistItemInput[];
}

class NodePositionInput {
  @IsUUID()
  id!: string;

  @IsNumber()
  position_x!: number;

  @IsNumber()
  position_y!: number;
}

export class BulkPositionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodePositionInput)
  positions!: NodePositionInput[];
}

export class PasteNodesDto {
  // The map the copied nodes came from (may differ from where they're pasted).
  @IsUUID()
  source_map_id!: string;

  // The copied nodes' ids (their sub-trees come along automatically).
  @IsArray()
  @IsUUID('all', { each: true })
  node_ids!: string[];

  // The level to paste into: a container id, or null/omitted for the map's top level.
  @IsOptional()
  @ValidateIf((o) => o.parent_node_id !== null)
  @IsUUID()
  parent_node_id?: string | null;

  // Where to drop the pasted cluster (canvas coords); the service offsets from here.
  @IsOptional()
  @IsNumber()
  position_x?: number;

  @IsOptional()
  @IsNumber()
  position_y?: number;
}
