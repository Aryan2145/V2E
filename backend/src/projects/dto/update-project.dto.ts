import { IsString, IsOptional, IsNumber, IsDateString, IsUUID, IsArray } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  project_manager_user_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  // The FULL set of goals this project serves — sending it replaces the links.
  // An empty array unlinks it from every goal.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  goal_ids?: string[];
}
