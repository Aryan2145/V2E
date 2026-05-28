import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AssignPolicyDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  employee_profile_ids: string[];
}
