import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateEmployeeDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  role_id?: string;

  @ApiPropertyOptional({ description: 'Access-rights bundle (System Role)' })
  @IsUUID()
  @IsOptional()
  system_role_id?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  department_id?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  reporting_to_user_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  employee_code?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 date string e.g. 2024-01-15' })
  @IsISO8601()
  @IsOptional()
  date_of_joining?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 date string e.g. 1995-06-15' })
  @IsISO8601()
  @IsOptional()
  date_of_birth?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 date string e.g. 2018-02-14' })
  @IsISO8601()
  @IsOptional()
  marriage_date?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  @IsOptional()
  employment_type?: EmploymentType;
}
