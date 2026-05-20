import { IsString, IsOptional, IsArray, IsEnum, IsBoolean } from 'class-validator'

export class CreateTemplateDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  owner_user_ids?: string[]

  @IsOptional()
  @IsEnum(['one_time', 'recurring'])
  workflow_nature?: string

  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly', 'yearly'])
  recurring_type?: string

  @IsOptional()
  @IsBoolean()
  show_workflow_on_task_card?: boolean
}
