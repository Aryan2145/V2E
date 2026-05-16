import apiClient from './client';
import type { EmployeeProfile, EmploymentType, EmployeeStatus, ApiResponse } from '../types';

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

export async function createEmployee(
  orgId: string,
  employeeData: {
    user_id: string;
    role_id: string;
    department_id: string;
    employment_type: EmploymentType;
    reporting_to_user_id?: string;
    employee_code?: string;
    date_of_joining?: string;
    status?: EmployeeStatus;
  }
): Promise<EmployeeProfile> {
  const { data } = await apiClient.post<ApiResponse<EmployeeProfile>>(
    `/api/v1/org/${orgId}/employees`,
    employeeData
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
    status: EmployeeStatus;
  }>
): Promise<EmployeeProfile> {
  const { data } = await apiClient.patch<ApiResponse<EmployeeProfile>>(
    `/api/v1/org/${orgId}/employees/${id}`,
    employeeData
  );
  return data.data;
}
