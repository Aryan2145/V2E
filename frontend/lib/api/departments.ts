import apiClient from './client';
import type { Department, ApiResponse } from '../types';

// ─── Departments API ──────────────────────────────────────────────────────────

export async function getDepartments(orgId: string): Promise<Department[]> {
  const { data } = await apiClient.get<ApiResponse<Department[]>>(
    `/api/v1/org/${orgId}/departments`
  );
  return data.data;
}

export async function createDepartment(
  orgId: string,
  departmentData: Partial<Omit<Department, 'id' | 'organization_id' | 'created_at' | 'updated_at' | '_count' | 'head_user'>>
): Promise<Department> {
  const { data } = await apiClient.post<ApiResponse<Department>>(
    `/api/v1/org/${orgId}/departments`,
    departmentData
  );
  return data.data;
}

export async function updateDepartment(
  orgId: string,
  id: string,
  departmentData: Partial<Omit<Department, 'id' | 'organization_id' | 'created_at' | 'updated_at' | '_count' | 'head_user'>>
): Promise<Department> {
  const { data } = await apiClient.patch<ApiResponse<Department>>(
    `/api/v1/org/${orgId}/departments/${id}`,
    departmentData
  );
  return data.data;
}

export async function deleteDepartment(orgId: string, id: string): Promise<void> {
  await apiClient.delete(`/api/v1/org/${orgId}/departments/${id}`);
}

export async function updateDepartmentPosition(
  orgId: string,
  id: string,
  x: number,
  y: number
): Promise<Department> {
  const { data } = await apiClient.patch<ApiResponse<Department>>(
    `/api/v1/org/${orgId}/departments/${id}/position`,
    { x, y }
  );
  return data.data;
}

export async function listImportBatches(orgId: string): Promise<any[]> {
  const { data } = await apiClient.get<ApiResponse<any[]>>(
    `/api/v1/org/${orgId}/departments/imports`
  );
  return data.data;
}

export async function createImportBatch(
  orgId: string,
  batchData: { file_name?: string; total_rows: number; created_count: number; failed_count: number; department_ids: string[] }
): Promise<any> {
  const { data } = await apiClient.post<ApiResponse<any>>(
    `/api/v1/org/${orgId}/departments/imports`,
    batchData
  );
  return data.data;
}

export async function undoImport(orgId: string, batchId: string): Promise<any> {
  const { data } = await apiClient.post<ApiResponse<any>>(
    `/api/v1/org/${orgId}/departments/imports/${batchId}/undo`
  );
  return data.data;
}
