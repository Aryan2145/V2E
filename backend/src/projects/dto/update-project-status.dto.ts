import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateProjectStatusDto {
  @IsString()
  @IsIn(['active', 'on_hold', 'completed', 'cancelled'])
  status: 'active' | 'on_hold' | 'completed' | 'cancelled';

  @IsOptional()
  @IsString()
  status_reason?: string;
}
