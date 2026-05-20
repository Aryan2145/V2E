import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray, IsObject } from 'class-validator'

export class CreateStepDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(['fixed_person', 'role'])
  assignee_type?: string

  @IsOptional()
  @IsString()
  assignee_user_id?: string

  @IsOptional()
  @IsString()
  assignee_role?: string

  @IsString()
  assigner_user_id: string

  @IsObject()
  deadline_config: Record<string, unknown>

  @IsOptional()
  @IsBoolean()
  proof_required?: boolean

  @IsOptional()
  @IsString()
  priority_id?: string

  @IsOptional()
  @IsString()
  category_id?: string

  @IsOptional()
  @IsArray()
  checklist_items?: { title: string; order_index: number }[]

  @IsOptional()
  @IsEnum(['block_next', 'proceed_anyway', 'trigger_branch'])
  if_overdue_action?: string

  @IsOptional()
  @IsString()
  branch_step_id?: string

  @IsOptional()
  @IsNumber()
  order_index?: number
}
