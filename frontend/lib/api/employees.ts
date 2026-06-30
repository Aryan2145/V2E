import apiClient from './client';
import type { EmployeeProfile, EmploymentType, EmployeeStatus, PeopleEventsResponse, ApiResponse } from '../types';

// ─── Employees API ────────────────────────────────────────────────────────────

export async function getEmployees(orgId: string): Promise<EmployeeProfile[]> {
  const { data } = await apiClient.get<ApiResponse<EmployeeProfile[]>>(
    `/api/v1/org/${orgId}/employees`
  );
  return data.data;
}

export async function getEmployee(orgId: string, id: string): Promise<EmployeeProfile> {
  const { data } = await apiClient.get<ApiResponse<EmployeeProfile>>(
    `/api/v1/org/${orgId}/employees/${id}`
  );
  return data.data;
}

export async function getReportingTree(orgId: string): Promise<EmployeeProfile[]> {
  const { data } = await apiClient.get<ApiResponse<EmployeeProfile[]>>(
    `/api/v1/org/${orgId}/employees/tree`
  );
  return data.data;
}

export async function getPeopleEvents(orgId: string, window = 30): Promise<PeopleEventsResponse> {
  const { data } = await apiClient.get<ApiResponse<PeopleEventsResponse>>(
    `/api/v1/org/${orgId}/employees/people-events?window=${window}`
  );
  return data.data;
}

export async function createEmployee(
  orgId: string,
  employeeData: {
    name: string;
    email: string;
    password: string;
    role_id: string;
    department_id: string;
    system_role_id?: string;
    reporting_to_user_id?: string;
    employee_code?: string;
    date_of_joining?: string;
    date_of_birth?: string;
    marriage_date?: string;
    employment_type?: EmploymentType;
    make_dep_head?: boolean;
  }
): Promise<EmployeeProfile> {
  const { data } = await apiClient.post<ApiResponse<EmployeeProfile>>(
    `/api/v1/org/${orgId}/employees`,
    employeeData
  );
  return data.data;
}

export interface BulkImportRow {
  name?: string;
  email?: string;
  password?: string;
  department?: string;
  is_department_head?: string;
  role?: string;
  system_role?: string;
  employment_type?: string;
  employee_code?: string;
  reporting_to?: string;
  date_of_joining?: string;
  date_of_birth?: string;
  marriage_date?: string;
}

// ─── Validation (dry-run) ───────────────────────────────────────────────────────

export type ImportRowStatus = 'ready' | 'duplicate' | 'error';

export interface ImportRowIssue {
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImportResolved {
  department?: string;
  role?: string;
  system_role?: string;
  reporting_to?: string;
  employment_type?: string;
}

export interface ImportValidationRow {
  row: number;
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

export async function validateImport(
  orgId: string,
  rows: BulkImportRow[]
): Promise<ImportValidationResult> {
  const { data } = await apiClient.post<ApiResponse<ImportValidationResult>>(
    `/api/v1/org/${orgId}/employees/bulk-import/validate`,
    { rows }
  );
  return data.data;
}

// ─── Commit ─────────────────────────────────────────────────────────────────────

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

export async function commitImport(
  orgId: string,
  rows: BulkImportRow[],
  fileName?: string
): Promise<BulkImportResult> {
  const { data } = await apiClient.post<ApiResponse<BulkImportResult>>(
    `/api/v1/org/${orgId}/employees/bulk-import/commit`,
    { rows, file_name: fileName }
  );
  return data.data;
}

// ─── History + undo ─────────────────────────────────────────────────────────────

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
  remaining: number;
  status: 'committed' | 'undone' | 'partially_undone';
  can_undo: boolean;
  created_at: string;
  undone_at: string | null;
}

export async function listImportBatches(orgId: string): Promise<ImportBatchSummary[]> {
  const { data } = await apiClient.get<ApiResponse<ImportBatchSummary[]>>(
    `/api/v1/org/${orgId}/employees/imports`
  );
  return data.data;
}

export async function undoImport(orgId: string, batchId: string): Promise<UndoImportResult> {
  const { data } = await apiClient.post<ApiResponse<UndoImportResult>>(
    `/api/v1/org/${orgId}/employees/imports/${batchId}/undo`,
    {}
  );
  return data.data;
}

export async function updateEmployee(
  orgId: string,
  id: string,
  employeeData: Partial<{
    role_id: string;
    department_id: string;
    system_role_id: string;
    employment_type: EmploymentType;
    reporting_to_user_id: string;
    employee_code: string;
    date_of_joining: string;
    date_of_birth: string;
    marriage_date: string;
    status: EmployeeStatus;
  }>
): Promise<EmployeeProfile> {
  const { data } = await apiClient.patch<ApiResponse<EmployeeProfile>>(
    `/api/v1/org/${orgId}/employees/${id}`,
    employeeData
  );
  return data.data;
}

// ─── Self-service ────────────────────────────────────────────────────────────────

/** The caller's own employee profile (resolved server-side from the JWT). */
export async function getMyProfile(orgId: string): Promise<EmployeeProfile> {
  const { data } = await apiClient.get<ApiResponse<EmployeeProfile>>(
    `/api/v1/org/${orgId}/employees/me`
  );
  return data.data;
}

/** Self-edit personal fields only (date of birth, marriage date). */
export async function updateMyProfile(
  orgId: string,
  body: Partial<{ date_of_birth: string | null; marriage_date: string | null }>
): Promise<EmployeeProfile> {
  const { data } = await apiClient.patch<ApiResponse<EmployeeProfile>>(
    `/api/v1/org/${orgId}/employees/me`,
    body
  );
  return data.data;
}
