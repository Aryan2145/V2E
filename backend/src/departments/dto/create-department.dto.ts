import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  parent_department_id?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  head_user_id?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsNumber()
  @IsOptional()
  position_x?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsNumber()
  @IsOptional()
  position_y?: number = 0;
}
