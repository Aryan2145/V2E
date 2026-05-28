import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePolicyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
