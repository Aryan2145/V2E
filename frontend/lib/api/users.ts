import apiClient from './client';
import type { User, ApiResponse } from '../types';

// ─── Users API ────────────────────────────────────────────────────────────────

export async function getUsers(orgId: string): Promise<User[]> {
  const { data } = await apiClient.get<ApiResponse<User[]>>(
    `/api/v1/org/${orgId}/users`
  );
  return data.data;
}

export async function createUser(
  orgId: string,
  userData: {
    name: string;
    email: string;
    password: string;
    is_admin?: boolean;
  }
): Promise<User> {
  const { data } = await apiClient.post<ApiResponse<User>>(
    `/api/v1/org/${orgId}/users`,
    userData
  );
  return data.data;
}
