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
 * One row from an uploaded sheet. Everything is an optional string here — the
 * import service validates each row individually so a single bad row produces a
 * friendly per-row error instead of failing (400-ing) the entire batch.
 * Department / role / system-role / manager are resolved by human-readable name.
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

  @ApiProperty({ required: false, description: 'Whether this employee is the head of their department (yes/no)' })
  @IsOptional()
  @IsString()
  is_department_head?: string;

  @ApiProperty({
    required: false,
    description: 'Job role — accepts "Role · Department" combined value or a plain title',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ required: false, description: 'System Role (access bundle) name — required' })
  @IsOptional()
  @IsString()
  system_role?: string;

  @ApiProperty({ required: false, description: 'full_time | part_time | contract' })
  @IsOptional()
  @IsString()
  employment_type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  employee_code?: string;

  @ApiProperty({ required: false, description: "Manager — accepts a name, \"Name · Dept · Role\", or an email" })
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

  @ApiProperty({ required: false, description: 'Original file name, stored on the import batch' })
  @IsOptional()
  @IsString()
  file_name?: string;
}

// ─── Validation (dry-run) result ────────────────────────────────────────────────

export type ImportRowStatus = 'ready' | 'duplicate' | 'error';

export interface ImportRowIssue {
  field?: string;
  message: string;
  severity: 'error' | 'warning'; // warning = soft duplicate; row still imports
}

export interface ImportResolved {
  department?: string;
  role?: string;
  system_role?: string;
  reporting_to?: string;
  employment_type?: string;
}

export interface ImportValidationRow {
  row: number; // 1-based sheet row (header is row 1, first data row is 2)
  name: string;
  email: string;
  status: ImportRowStatus;
  resolved: ImportResolved;
  issues: ImportRowIssue[];
}

export interface ImportValidationResult {
  total: number;
  ready: number;
  duplicates: number;
  errors: number;
  warnings: number;
  rows: ImportValidationRow[];
}

// ─── Commit result ──────────────────────────────────────────────────────────────

export interface BulkImportRowResult {
  row: number;
  name: string;
  email: string;
  status: 'created' | 'failed';
  error?: string;
}

export interface BulkImportResult {
  batch_id: string | null;
  created: number;
  failed: number;
  results: BulkImportRowResult[];
}

// ─── Undo + history ─────────────────────────────────────────────────────────────

export interface UndoKeptRow {
  name: string;
  email: string;
  reason: string;
}

export interface UndoImportResult {
  batch_id: string;
  undone: number;
  kept: UndoKeptRow[];
  status: 'committed' | 'undone' | 'partially_undone';
}

export interface ImportBatchSummary {
  id: string;
  file_name: string | null;
  imported_by: string;
  total_rows: number;
  created_count: number;
  failed_count: number;
  remaining: number; // profiles from this batch still present
  status: 'committed' | 'undone' | 'partially_undone';
  can_undo: boolean; // within the undo window, committed, and rows remain
  created_at: string;
  undone_at: string | null;
}
