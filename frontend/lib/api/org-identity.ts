import apiClient from './client';
import type { OrgIdentity, ValueItem, ApiResponse } from '../types';

// ─── Org Identity API ─────────────────────────────────────────────────────────

export async function getOrgIdentity(orgId: string): Promise<OrgIdentity> {
  const { data } = await apiClient.get<ApiResponse<OrgIdentity>>(
    `/api/v1/org/${orgId}/identity`
  );
  return data.data;
}

export async function upsertOrgIdentity(
  orgId: string,
  identityData: Partial<{
    vision: string;
    mission: string;
    purpose: string;
    values: ValueItem[];
  }>
): Promise<OrgIdentity> {
  const { data } = await apiClient.put<ApiResponse<OrgIdentity>>(
    `/api/v1/org/${orgId}/identity`,
    identityData
  );
  return data.data;
}
