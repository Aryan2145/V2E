import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';

// Create a swimlane (a department band) in the Company pool of one flow level.
// Mirrors the connection DTO: parent_node_id scopes which level the lane lives in.
export class CreateLaneDto {
  @IsUUID()
  department_id!: string;

  // The level (container id) this lane belongs to; null/omitted = the map's root flow.
  @IsOptional()
  @ValidateIf((o) => o.parent_node_id !== null)
  @IsUUID()
  parent_node_id?: string | null;
}

// Re-point a lane at a different department (rename it) — its steps move with it.
export class ReassignLaneDto {
  @IsUUID()
  department_id!: string;
}

// Set the top→bottom order of the department lanes at one level.
export class ReorderLanesDto {
  @IsOptional()
  @ValidateIf((o) => o.parent_node_id !== null)
  @IsUUID()
  parent_node_id?: string | null;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  lane_ids!: string[];
}

// Set the top→bottom order of the pools (customer/company/vendor) at one level.
export class PoolOrderDto {
  @IsOptional()
  @ValidateIf((o) => o.parent_node_id !== null)
  @IsUUID()
  parent_node_id?: string | null;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['customer', 'company', 'vendor'], { each: true })
  pools!: string[];
}
