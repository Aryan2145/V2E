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
  IsBoolean,
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

  // Optional: only a BRAND-NEW account needs a password. When the email already
  // belongs to an existing V2E login (the person is in other firms), no password is
  // sent — they keep their existing one. The service enforces "required for new user".
  @ApiPropertyOptional({ minLength: 8 })
  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @ApiProperty({ description: 'Job role (title / designation)' })
  @IsUUID()
  @IsNotEmpty()
  role_id: string;

  @ApiProperty({ description: 'Access-rights bundle (System Role) — required' })
  @IsUUID()
  @IsNotEmpty()
  system_role_id: string;

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

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  make_dep_head?: boolean;
}
