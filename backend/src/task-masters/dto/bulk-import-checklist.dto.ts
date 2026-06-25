import { IsArray, IsOptional, IsString, ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** One spreadsheet row: a single checklist item belonging to a named checklist. */
export class BulkImportChecklistRowDto {
  @ApiProperty({ required: false, description: 'Checklist name — groups rows into one template' })
  @IsOptional()
  @IsString()
  checklist_name?: string;

  @ApiProperty({ required: false, description: 'A single checklist item line' })
  @IsOptional()
  @IsString()
  item?: string;
}

export class BulkImportChecklistsDto {
  @ApiProperty({ type: [BulkImportChecklistRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => BulkImportChecklistRowDto)
  rows: BulkImportChecklistRowDto[];

  @ApiProperty({ required: false, description: 'Original file name, stored on the import batch' })
  @IsOptional()
  @IsString()
  file_name?: string;
}

// ─── Result shapes ──────────────────────────────────────────────────────────────

export type ChecklistImportRowStatus = 'ready' | 'error';

export interface ChecklistImportRowIssue {
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ChecklistImportRow {
  row: number; // 1-based sheet row (header is row 1, first data row is 2)
  checklist_name: string;
  item: string;
  status: ChecklistImportRowStatus;
  issues: ChecklistImportRowIssue[];
}

/** A checklist that would be created, grouped from its item rows. */
export interface ChecklistImportGroup {
  name: string;
  items: string[];
  already_exists: boolean; // a template with this name already exists in the org
}

export interface ChecklistImportValidationResult {
  total: number; // total item rows
  ready: number; // item rows with no error
  errors: number; // item rows with an error
  warnings: number; // item rows with a warning
  templates: number; // distinct checklists that would be created
  rows: ChecklistImportRow[];
  groups: ChecklistImportGroup[];
}

export interface ChecklistImportGroupResult {
  name: string;
  item_count: number;
  status: 'created' | 'failed';
  error?: string;
}

export interface ChecklistImportResult {
  batch_id: string | null;
  created: number; // templates created
  failed: number; // groups rejected
  results: ChecklistImportGroupResult[];
}

export interface ChecklistUndoKeptRow {
  name: string;
  reason: string;
}

export interface ChecklistUndoImportResult {
  batch_id: string;
  undone: number;
  kept: ChecklistUndoKeptRow[];
  status: 'committed' | 'undone' | 'partially_undone';
}

export interface ChecklistImportBatchSummary {
  id: string;
  file_name: string | null;
  imported_by: string;
  total_rows: number; // checklist groups submitted
  created_count: number;
  failed_count: number;
  remaining: number; // templates from this batch still present
  status: 'committed' | 'undone' | 'partially_undone';
  can_undo: boolean;
  created_at: string;
  undone_at: string | null;
}
