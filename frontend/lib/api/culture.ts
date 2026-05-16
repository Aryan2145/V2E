import apiClient from './client';
import type { CultureStandard, BehaviorType, ApiResponse } from '../types';

// ─── Culture Standards API ────────────────────────────────────────────────────

export async function getCultureStandards(orgId: string): Promise<CultureStandard[]> {
  const { data } = await apiClient.get<ApiResponse<CultureStandard[]>>(
    `/api/v1/org/${orgId}/culture`
  );
  return data.data;
}

export async function createCultureStandard(
  orgId: string,
  standardData: {
    title: string;
    description: string;
    type: BehaviorType;
  }
): Promise<CultureStandard> {
  const { data } = await apiClient.post<ApiResponse<CultureStandard>>(
    `/api/v1/org/${orgId}/culture`,
    standardData
  );
  return data.data;
}

export async function updateCultureStandard(
  orgId: string,
  id: string,
  standardData: Partial<{
    title: string;
    description: string;
    type: BehaviorType;
  }>
): Promise<CultureStandard> {
  const { data } = await apiClient.patch<ApiResponse<CultureStandard>>(
    `/api/v1/org/${orgId}/culture/${id}`,
    standardData
  );
  return data.data;
}

export async function deleteCultureStandard(orgId: string, id: string): Promise<void> {
  await apiClient.delete(`/api/v1/org/${orgId}/culture/${id}`);
}
