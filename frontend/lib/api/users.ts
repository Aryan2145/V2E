import apiClient from './client';
import type { User, ApiResponse } from '../types';

// ─── Users API ────────────────────────────────────────────────────────────────

export async function getUsers(orgId: string): Promise<User[]> {
  const { data } = await apiClient.get<ApiResponse<User[]>>(
    `/api/v1/org/${orgId}/users`
  );
  return data.data;
}

export async function updateUser(
  orgId: string,
  userId: string,
  userData: Partial<{
    name: string;
    email: string;
    password: string;
    is_admin: boolean;
    is_active: boolean;
  }>
): Promise<User> {
  const { data } = await apiClient.patch<ApiResponse<User>>(
    `/api/v1/org/${orgId}/users/${userId}`,
    userData
  );
  return data.data;
}
