import apiClient from './client'
import type { ApiResponse } from '../types'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PermAction = 'read' | 'write' | 'edit' | 'delete'
export type OverrideEffect = 'grant' | 'revoke'
// 3-level data-scope model: Own / My Team / Company. (`department` is a retired
// legacy value the backend may still echo for old rows; map it to team for display.)
export type DataScope = 'own' | 'team' | 'org'

export const DATA_SCOPES: DataScope[] = ['own', 'team', 'org']
export const DATA_SCOPE_LABEL: Record<DataScope, string> = {
  own: 'Own',
  team: 'My Team',
  org: 'Company',
}
export const DATA_SCOPE_HELP: Record<DataScope, string> = {
  own: 'Only their own records',
  team: 'Them and everyone who reports up to them',
  org: 'Every record in the company',
}
// Cascade ordering, narrowest → widest (for the "broadened" badge).
export const SCOPE_RANK: Record<DataScope, number> = { own: 0, team: 1, org: 2 }
export function normalizeScope(s: string | null | undefined): DataScope {
  return s === 'org' || s === 'team' ? s : s === 'department' ? 'team' : 'own'
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
  entitlementState: 'off' | 'preview' | 'full'
  subModules: RegistrySubModule[]
}

export interface SystemRole {
  id: string
  name: string
  description: string | null
  is_system: boolean
  is_admin: boolean
  default_scope: DataScope // global tier of the scope cascade
  module_scopes: Record<string, DataScope> // moduleKey → scope (module tier)
}

export interface RoleMatrix {
  systemRoles: SystemRole[]
  permissions: Record<string, Record<string, ResourcePerms>>
  // roleId → leafKey → action → DataScope (line tier; absent ⇒ inherits cascade)
  scopes: Record<string, Record<string, Partial<Record<PermAction, DataScope>>>>
  scopableLeaves: string[]
}

/** Lightweight role for pickers (Add Employee). */
export interface SystemRoleLite {
  id: string
  name: string
  is_system: boolean
  is_admin: boolean
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
  system_role: { id: string; name: string | null } | null
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
  entries: { system_role_id: string; feature_key: string; action: PermAction; allowed: boolean; scope?: DataScope | null }[],
): Promise<RoleMatrix> {
  const { data } = await apiClient.put<ApiResponse<RoleMatrix>>(`${base(orgId)}/role-permissions`, { entries })
  return data.data
}

// ─── System Role CRUD + scope cascade ───────────────────────────────────────────

export async function listSystemRoles(orgId: string): Promise<{ systemRoles: SystemRoleLite[] }> {
  const { data } = await apiClient.get<ApiResponse<{ systemRoles: SystemRoleLite[] }>>(`${base(orgId)}/system-roles`)
  return data.data
}

export async function createSystemRole(
  orgId: string,
  body: { name: string; description?: string; default_scope?: DataScope },
): Promise<RoleMatrix> {
  const { data } = await apiClient.post<ApiResponse<RoleMatrix>>(`${base(orgId)}/system-roles`, body)
  return data.data
}

export async function updateSystemRole(
  orgId: string,
  roleId: string,
  body: { name?: string; description?: string; default_scope?: DataScope },
): Promise<RoleMatrix> {
  const { data } = await apiClient.patch<ApiResponse<RoleMatrix>>(`${base(orgId)}/system-roles/${roleId}`, body)
  return data.data
}

export async function deleteSystemRole(orgId: string, roleId: string): Promise<RoleMatrix> {
  const { data } = await apiClient.delete<ApiResponse<RoleMatrix>>(`${base(orgId)}/system-roles/${roleId}`)
  return data.data
}

export async function setModuleScope(
  orgId: string,
  roleId: string,
  module_key: string,
  scope: DataScope | null,
): Promise<RoleMatrix> {
  const { data } = await apiClient.put<ApiResponse<RoleMatrix>>(
    `${base(orgId)}/system-roles/${roleId}/module-scope`,
    { module_key, scope },
  )
  return data.data
}

// ─── Eligible-subject pickers ───────────────────────────────────────────────────
// One shared endpoint every "who can be acted upon" picker consumes. Returns ALL
// candidates annotated with `eligible` + `reason`, so the picker can grey-out
// ineligible people (with the reason) instead of letting the user pick someone and
// then hit a blocking error on submit.

export interface EligibleSubjectItem {
  userId: string
  name: string
  email?: string
  department?: string | null
  eligible: boolean
  reason?: string
}

export async function listEligibleSubjects(
  orgId: string,
  subjectKey: string,
  opts?: { candidateIds?: string[]; search?: string },
): Promise<EligibleSubjectItem[]> {
  const params = new URLSearchParams()
  if (opts?.search) params.set('search', opts.search)
  if (opts?.candidateIds?.length) params.set('candidateIds', opts.candidateIds.join(','))
  const qs = params.toString()
  const { data } = await apiClient.get<ApiResponse<{ items: EligibleSubjectItem[] }>>(
    `${base(orgId)}/eligible-subjects/${subjectKey}${qs ? `?${qs}` : ''}`,
  )
  return data.data.items
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

// ─── Access visibility ("is this empty, or am I just not allowed to see it?") ───

export type VisibilityReason = 'ok' | 'no_system_role' | 'role_lacks_permission'

export interface AccessVisibility {
  leaf: string
  module_label: string
  can_read: boolean
  scope: DataScope | null
  /** Rows assigned to me, ignoring scope. null = module has no counter. */
  assigned_count: number | null
  has_system_role: boolean
  reason: VisibilityReason
}

/**
 * Ask why a module looks empty. Callable even when the caller is denied read on the
 * module (gated by auth + org only), so a hidden user can be shown an honest message.
 */
export async function getAccessVisibility(orgId: string, leaf: string): Promise<AccessVisibility> {
  const { data } = await apiClient.get<ApiResponse<AccessVisibility>>(
    `${base(orgId)}/access/visibility/${leaf}`,
  )
  return data.data
}
