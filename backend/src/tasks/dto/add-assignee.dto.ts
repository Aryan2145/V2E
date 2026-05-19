import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AddAssigneeDto {
  @IsString()
  user_id: string;

  @IsOptional()
  @IsBoolean()
  is_cc?: boolean;
}
