import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateConfigDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  task_creation_roles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  task_edit_roles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  task_delete_roles?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  default_reminder_days_before?: number;

  @IsOptional()
  @IsString()
  default_reminder_frequency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  reopen_window_minutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  escalation_levels?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  archive_view_roles?: string[];

  @IsOptional()
  @IsString()
  assignee_visibility_mode?: string;

  @IsOptional()
  assignee_custom_rules?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignee_visibility_config_roles?: string[];
}
