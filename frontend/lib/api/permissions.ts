import apiClient from './client'
import type { ApiResponse } from '../types'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PermAction = 'read' | 'write' | 'edit' | 'delete'
export type OverrideEffect = 'grant' | 'revoke'
export type DataScope = 'own' | 'team' | 'department' | 'org'

export const DATA_SCOPES: DataScope[] = ['own', 'team', 'department', 'org']
export const DATA_SCOPE_LABEL: Record<DataScope, string> = {
  own: 'Own',
  team: 'Team',
  department: 'Department',
  org: 'Organization',
}

export interface ResourcePerms {
  read: boolean
  write: boolean
  edit: boolean
  delete: boolean
}

export interface PermissionLeafNode {
  key: string
  label: string
  description?: string
  axis: 'actor' | 'subject'
  kind: 'admin' | 'feature'
  actions: PermAction[]
}

export interface RegistrySubModule {
  key: string
  label: string
  features: PermissionLeafNode[]
}

export interface RegistryModule {
  key: string
  label: string
  entitlementControlled: boolean
  subModules: RegistrySubModule[]
}

export interface JobRole {
  id: string
  title: string
  level: string
  department: { id: string; name: string } | null
}

export interface RoleMatrix {
  jobRoles: JobRole[]
  permissions: Record<string, Record<string, ResourcePerms>>
  // roleId → leafKey → action → DataScope (scopable content leaves only)
  scopes: Record<string, Record<string, Partial<Record<PermAction, DataScope>>>>
  scopableLeaves: string[]
}

export interface SubjectPolicy {
  subject_key: string
  label: string
  default_eligible: boolean
}

export interface UserPermissionLeaf {
  key: string
  inherited: ResourcePerms
  overrides: Record<PermAction, OverrideEffect | null>
  scopable?: boolean
  override_scopes?: Record<PermAction, DataScope | null>
  effective_scopes?: Partial<Record<PermAction, DataScope>>
  effective: ResourcePerms
}

export interface UserPermissions {
  user_id: string
  job_role: { id: string; title: string | null } | null
  is_admin: boolean
  is_super_admin: boolean
  leaves: UserPermissionLeaf[]
  subject_overrides: { subject_key: string; label: string; override: OverrideEffect | null }[]
}

export interface MyPermissions {
  leaves: Record<string, ResourcePerms>
  // leafKey → action → effective DataScope (scopable content leaves only)
  scopes?: Record<string, Partial<Record<PermAction, DataScope>>>
  is_admin: boolean
  is_super_admin: boolean
}

// ─── API ───────────────────────────────────────────────────────────────────────

const base = (orgId: string) => `/api/v1/org/${orgId}`

export async function getPermissionRegistry(orgId: string): Promise<{ modules: RegistryModule[] }> {
  const { data } = await apiClient.get<ApiResponse<{ modules: RegistryModule[] }>>(`${base(orgId)}/permission-registry`)
  return data.data
}

export async function getRolePermissions(orgId: string): Promise<RoleMatrix> {
  const { data } = await apiClient.get<ApiResponse<RoleMatrix>>(`${base(orgId)}/role-permissions`)
  return data.data
}

export async function updateRolePermissions(
  orgId: string,
  entries: { job_role_id: string; feature_key: string; action: PermAction; allowed: boolean; scope?: DataScope | null }[],
): Promise<RoleMatrix> {
  const { data } = await apiClient.put<ApiResponse<RoleMatrix>>(`${base(orgId)}/role-permissions`, { entries })
  return data.data
}

export async function getSubjectPolicies(orgId: string): Promise<{ policies: SubjectPolicy[] }> {
  const { data } = await apiClient.get<ApiResponse<{ policies: SubjectPolicy[] }>>(`${base(orgId)}/subject-policies`)
  return data.data
}

export async function updateSubjectPolicies(
  orgId: string,
  entries: { subject_key: string; default_eligible: boolean }[],
): Promise<{ policies: SubjectPolicy[] }> {
  const { data } = await apiClient.put<ApiResponse<{ policies: SubjectPolicy[] }>>(`${base(orgId)}/subject-policies`, { entries })
  return data.data
}

export async function getUserPermissions(orgId: string, userId: string): Promise<UserPermissions> {
  const { data } = await apiClient.get<ApiResponse<UserPermissions>>(`${base(orgId)}/users/${userId}/permissions`)
  return data.data
}

export async function setUserOverride(
  orgId: string,
  userId: string,
  body: { feature_key: string; action: PermAction; effect: OverrideEffect | null; scope?: DataScope | null; reason?: string },
): Promise<UserPermissions> {
  const { data } = await apiClient.put<ApiResponse<UserPermissions>>(`${base(orgId)}/users/${userId}/overrides`, body)
  return data.data
}

export async function setUserSubjectOverride(
  orgId: string,
  userId: string,
  body: { subject_key: string; effect: OverrideEffect | null; reason?: string },
): Promise<UserPermissions> {
  const { data } = await apiClient.put<ApiResponse<UserPermissions>>(`${base(orgId)}/users/${userId}/subject-overrides`, body)
  return data.data
}

export async function getMyPermissions(orgId: string): Promise<MyPermissions> {
  const { data } = await apiClient.get<ApiResponse<MyPermissions>>(`${base(orgId)}/my-permissions`)
  return data.data
}
