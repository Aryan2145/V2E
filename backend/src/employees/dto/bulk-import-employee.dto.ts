import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * One row from an uploaded CSV. Everything is an optional string here — the
 * service validates each row individually so a single bad row produces a
 * friendly per-row error instead of failing (400-ing) the entire batch.
 * Department / role / manager are resolved by human-readable name + email.
 */
export class BulkImportRowDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false, description: 'Defaults to Welcome@123 if blank' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ required: false, description: 'Department name (must already exist)' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ required: false, description: 'Role title within the department (must already exist)' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ required: false, description: 'full_time | part_time | contract' })
  @IsOptional()
  @IsString()
  employment_type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  employee_code?: string;

  @ApiProperty({ required: false, description: "Name of this person's manager (must already exist in the org). An email is also accepted." })
  @IsOptional()
  @IsString()
  reporting_to?: string;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  date_of_joining?: string;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  date_of_birth?: string;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  marriage_date?: string;
}

export class BulkImportEmployeesDto {
  @ApiProperty({ type: [BulkImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => BulkImportRowDto)
  rows: BulkImportRowDto[];
}

export interface BulkImportRowResult {
  row: number;
  name: string;
  email: string;
  status: 'created' | 'failed';
  error?: string;
}

export interface BulkImportResult {
  created: number;
  failed: number;
  results: BulkImportRowResult[];
}
