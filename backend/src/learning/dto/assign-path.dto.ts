import { IsArray, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AssignPathDto {
  @IsArray()
  @IsUUID('all', { each: true })
  employee_profile_ids: string[];

  @IsOptional()
  @IsDateString()
  due_date?: string;
}
