import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

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
