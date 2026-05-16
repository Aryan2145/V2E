import apiClient from './client';
import type { Role, RoleLevel, KraItem, KpiItem, ApiResponse } from '../types';

// ─── Roles API ────────────────────────────────────────────────────────────────

export async function getRoles(orgId: string, departmentId?: string): Promise<Role[]> {
  const params = departmentId ? { departmentId } : undefined;
  const { data } = await apiClient.get<ApiResponse<Role[]>>(
    `/api/v1/org/${orgId}/roles`,
    { params }
  );
  return data.data;
}

export async function getRole(orgId: string, id: string): Promise<Role> {
  const { data } = await apiClient.get<ApiResponse<Role>>(
    `/api/v1/org/${orgId}/roles/${id}`
  );
  return data.data;
}

export async function createRole(
  orgId: string,
  roleData: {
    department_id: string;
    title: string;
    level: RoleLevel;
    job_description?: string;
    kra?: KraItem[];
    kpi?: KpiItem[];
  }
): Promise<Role> {
  const { data } = await apiClient.post<ApiResponse<Role>>(
    `/api/v1/org/${orgId}/roles`,
    roleData
  );
  return data.data;
}

export async function updateRole(
  orgId: string,
  id: string,
  roleData: Partial<{
    department_id: string;
    title: string;
    level: RoleLevel;
    job_description: string;
    kra: KraItem[];
    kpi: KpiItem[];
  }>
): Promise<Role> {
  const { data } = await apiClient.patch<ApiResponse<Role>>(
    `/api/v1/org/${orgId}/roles/${id}`,
    roleData
  );
  return data.data;
}

export async function deleteRole(orgId: string, id: string): Promise<void> {
  await apiClient.delete(`/api/v1/org/${orgId}/roles/${id}`);
}
