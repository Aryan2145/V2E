import { IsString, IsOptional } from 'class-validator';

export class LinkProjectTaskDto {
  @IsString()
  task_id: string;

  @IsOptional()
  @IsString()
  milestone_id?: string;
}
