import { ArrayMaxSize, IsArray, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AssignPathDto {
  @IsArray()
  @ArrayMaxSize(1000) // guardrail: no unbounded bulk-assign in one request
  @IsUUID('all', { each: true })
  employee_profile_ids: string[];

  @IsOptional()
  @IsDateString()
  due_date?: string;
}
