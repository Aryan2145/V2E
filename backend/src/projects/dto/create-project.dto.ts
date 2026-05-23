import { IsString, IsOptional, IsArray, IsNumber, IsDateString } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  project_manager_user_id: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsNumber()
  planned_budget?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  template_id?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  member_user_ids?: string[];
}
