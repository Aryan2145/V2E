import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePolicyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}
