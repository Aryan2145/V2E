import { IsString, IsOptional, IsIn } from 'class-validator';

export class AddProjectMemberDto {
  @IsString()
  user_id: string;

  @IsOptional()
  @IsString()
  @IsIn(['manager', 'editor', 'viewer'])
  role?: 'manager' | 'editor' | 'viewer';

  @IsOptional()
  @IsString()
  @IsIn(['own_tasks_only', 'all_member_tasks'])
  task_visibility?: 'own_tasks_only' | 'all_member_tasks';
}
