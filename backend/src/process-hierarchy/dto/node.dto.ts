import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
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
}

export class UpdateNodeDto {
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
