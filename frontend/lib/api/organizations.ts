import apiClient from './client';
import type { Organization, OrgDetail, ApiResponse } from '../types';

// ─── Organizations API ────────────────────────────────────────────────────────

export async function getOrganizations(): Promise<Organization[]> {
  const { data } = await apiClient.get<ApiResponse<Organization[]>>('/api/v1/organizations');
  return data.data;
}

export async function getOrganization(id: string): Promise<OrgDetail> {
  const { data } = await apiClient.get<ApiResponse<OrgDetail>>(`/api/v1/organizations/${id}`);
  return data.data;
}

export async function createOrganization(orgData: {
  name: string
  slug: string
  group_id?: string
  existing_user_id?: string
  admin_name?: string
  admin_email?: string
  admin_password?: string
  logo_url?: string
  industry?: string
  country?: string
  timezone?: string
  status?: string
}): Promise<Organization> {
  const { data } = await apiClient.post<ApiResponse<Organization>>(
    '/api/v1/organizations',
    orgData
  );
  return data.data;
}

export async function updateOrganization(
  id: string,
  orgData: Partial<Omit<Organization, 'id' | 'created_at' | 'updated_at'>>
): Promise<Organization> {
  const { data } = await apiClient.patch<ApiResponse<Organization>>(
    `/api/v1/organizations/${id}`,
    orgData
  );
  return data.data;
}

export async function deactivateOrganization(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/organizations/${id}/deactivate`);
}
