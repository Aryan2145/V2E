import apiClient from './client';
import type { OrganizationGroup, ApiResponse } from '../types';

export interface GroupUser {
  user_id: string;
  name: string;
  email: string;
  orgs: Array<{ id: string; name: string }>;
}

export async function getGroups(): Promise<OrganizationGroup[]> {
  const { data } = await apiClient.get<ApiResponse<OrganizationGroup[]>>('/api/v1/groups');
  return data.data;
}

export async function getGroup(id: string): Promise<OrganizationGroup> {
  const { data } = await apiClient.get<ApiResponse<OrganizationGroup>>(`/api/v1/groups/${id}`);
  return data.data;
}

export async function createGroup(dto: { name: string; description?: string }): Promise<OrganizationGroup> {
  const { data } = await apiClient.post<ApiResponse<OrganizationGroup>>('/api/v1/groups', dto);
  return data.data;
}

export async function updateGroup(id: string, dto: { name?: string; description?: string }): Promise<OrganizationGroup> {
  const { data } = await apiClient.patch<ApiResponse<OrganizationGroup>>(`/api/v1/groups/${id}`, dto);
  return data.data;
}

export async function addOrgToGroup(groupId: string, orgId: string): Promise<void> {
  await apiClient.post(`/api/v1/groups/${groupId}/orgs`, { org_id: orgId });
}

export async function removeOrgFromGroup(groupId: string, orgId: string): Promise<void> {
  await apiClient.delete(`/api/v1/groups/${groupId}/orgs/${orgId}`);
}

export async function getGroupUsers(groupId: string): Promise<GroupUser[]> {
  const { data } = await apiClient.get<ApiResponse<GroupUser[]>>(`/api/v1/groups/${groupId}/users`);
  return data.data;
}
