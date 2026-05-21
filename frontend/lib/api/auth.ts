import apiClient from './client';
import type { AuthTokens, AuthUser, ApiResponse, OrgMembership, LoginResponse } from '../types';

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<{ data: LoginResponse }>('/api/v1/auth/login', {
    email,
    password,
  });
  return data.data;
}

export async function adminLogin(email: string, password: string): Promise<AuthTokens> {
  const { data } = await apiClient.post<{ data: AuthTokens }>('/api/v1/auth/admin-login', {
    email,
    password,
  });
  return data.data;
}

export async function register(registerData: {
  name: string;
  email: string;
  password: string;
  role?: string;
  organization_id?: string;
}): Promise<ApiResponse<AuthUser>> {
  const { data } = await apiClient.post<ApiResponse<AuthUser>>(
    '/api/v1/auth/register',
    registerData
  );
  return data;
}

export async function refreshToken(token: string): Promise<{ access_token: string; refresh_token?: string }> {
  const { data } = await apiClient.post<ApiResponse<{ access_token: string; refresh_token?: string }>>(
    '/api/v1/auth/refresh',
    { refresh_token: token }
  );
  return data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/api/v1/auth/logout');
}

export async function getMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<ApiResponse<AuthUser>>('/api/v1/auth/me');
  return data.data;
}

export async function switchOrg(organizationId: string): Promise<AuthTokens> {
  const { data } = await apiClient.post<{ data: AuthTokens }>('/api/v1/auth/switch-org', {
    organizationId,
  });
  return data.data;
}

export async function getMyOrgs(): Promise<OrgMembership[]> {
  const { data } = await apiClient.get<ApiResponse<OrgMembership[]>>('/api/v1/auth/my-orgs');
  return data.data;
}
