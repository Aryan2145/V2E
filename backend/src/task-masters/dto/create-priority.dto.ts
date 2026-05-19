import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePriorityDto {
  @IsString()
  @MaxLength(50)
  label: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  order_index?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
