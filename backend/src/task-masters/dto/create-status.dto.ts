import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { STATUS_PHASES } from '../../tasks/status-phase';

export class CreateStatusDto {
  @IsString()
  @MaxLength(50)
  label: string;

  @IsIn(STATUS_PHASES as unknown as string[])
  type: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  order_index?: number;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
