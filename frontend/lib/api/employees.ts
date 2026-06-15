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
    reporting_to_user_id?: string;
    employee_code?: string;
    date_of_joining?: string;
    date_of_birth?: string;
    marriage_date?: string;
    employment_type?: EmploymentType;
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
  role?: string;
  employment_type?: string;
  employee_code?: string;
  reporting_to?: string;
  date_of_joining?: string;
  date_of_birth?: string;
  marriage_date?: string;
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

export async function bulkImportEmployees(
  orgId: string,
  rows: BulkImportRow[]
): Promise<BulkImportResult> {
  const { data } = await apiClient.post<ApiResponse<BulkImportResult>>(
    `/api/v1/org/${orgId}/employees/bulk-import`,
    { rows }
  );
  return data.data;
}

export async function updateEmployee(
  orgId: string,
  id: string,
  employeeData: Partial<{
    role_id: string;
    department_id: string;
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
