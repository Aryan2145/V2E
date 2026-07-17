import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SaveAsTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class InstantiateTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}
