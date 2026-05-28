import apiClient from './client'
import type { CompanyPolicy, CompanyPolicyItem, CompanyPolicyAssignment, PolicyContentType } from '../types/company-policy'

function base(orgId: string) {
  return `/api/v1/org/${orgId}/ecs/policies`
}

function unwrap<T>(res: any): T {
  return res.data?.data ?? res.data
}

export async function getPolicies(orgId: string): Promise<CompanyPolicy[]> {
  return unwrap(await apiClient.get(base(orgId)))
}

export async function getPolicy(orgId: string, id: string): Promise<CompanyPolicy> {
  return unwrap(await apiClient.get(`${base(orgId)}/${id}`))
}

export async function createPolicy(orgId: string, data: { title: string; description?: string }): Promise<CompanyPolicy> {
  return unwrap(await apiClient.post(base(orgId), data))
}

export async function updatePolicy(orgId: string, id: string, data: { title?: string; description?: string }): Promise<CompanyPolicy> {
  return unwrap(await apiClient.patch(`${base(orgId)}/${id}`, data))
}

export async function publishPolicy(orgId: string, id: string): Promise<CompanyPolicy> {
  return unwrap(await apiClient.post(`${base(orgId)}/${id}/publish`))
}

export async function archivePolicy(orgId: string, id: string): Promise<CompanyPolicy> {
  return unwrap(await apiClient.post(`${base(orgId)}/${id}/archive`))
}

export async function deletePolicy(orgId: string, id: string): Promise<void> {
  await apiClient.delete(`${base(orgId)}/${id}`)
}

export async function addItem(orgId: string, policyId: string, data: {
  title: string
  description?: string
  content_type: PolicyContentType
  content_url?: string
  content_body?: string
}): Promise<CompanyPolicyItem> {
  return unwrap(await apiClient.post(`${base(orgId)}/${policyId}/items`, data))
}

export async function updateItem(orgId: string, policyId: string, itemId: string, data: Partial<{
  title: string
  description: string
  content_type: PolicyContentType
  content_url: string
  content_body: string
}>): Promise<CompanyPolicyItem> {
  return unwrap(await apiClient.patch(`${base(orgId)}/${policyId}/items/${itemId}`, data))
}

export async function deleteItem(orgId: string, policyId: string, itemId: string): Promise<void> {
  await apiClient.delete(`${base(orgId)}/${policyId}/items/${itemId}`)
}

export async function assignPolicy(orgId: string, policyId: string, employee_profile_ids: string[]): Promise<{ assigned: number; skipped: number }> {
  return unwrap(await apiClient.post(`${base(orgId)}/${policyId}/assign`, { employee_profile_ids }))
}

export async function getAssignments(orgId: string, policyId: string): Promise<CompanyPolicyAssignment[]> {
  return unwrap(await apiClient.get(`${base(orgId)}/${policyId}/assignments`))
}
