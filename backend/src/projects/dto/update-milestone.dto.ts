import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class UpdateMilestoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsNumber()
  order_index?: number;
}
