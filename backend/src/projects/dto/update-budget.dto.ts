import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateBudgetDto {
  @IsOptional()
  @IsNumber()
  planned_budget?: number;

  @IsOptional()
  @IsNumber()
  actual_spent?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
