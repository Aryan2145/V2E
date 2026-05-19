import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visible_to_departments?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visible_to_roles?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
