import { IsString } from 'class-validator';

export class AddDependencyDto {
  @IsString()
  task_id: string;

  @IsString()
  depends_on_task_id: string;
}
