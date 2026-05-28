import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ description: 'Full name for the user account' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  role_id: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  department_id: string;

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
