import apiClient from './client'
import type { AuditListResponse, AuditResourcesResponse } from '@/lib/types/audit'

const base = (orgId: string) => `/api/v1/org/${orgId}/audit-logs`

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

export interface AuditFilters {
  resource?: string
  module?: string
  action?: string
  actor_user_id?: string
  actor_type?: string
  trigger_source?: string
  entity_id?: string
  from_date?: string
  to_date?: string
  search?: string
  skip?: number
  take?: number
}

export const auditApi = {
  list: async (orgId: string, filters: AuditFilters = {}): Promise<AuditListResponse> => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v))
    })
    const qs = params.toString()
    const res = await apiClient.get(`${base(orgId)}${qs ? `?${qs}` : ''}`)
    return unwrap<AuditListResponse>(res)
  },

  resources: async (orgId: string): Promise<AuditResourcesResponse> => {
    const res = await apiClient.get(`${base(orgId)}/resources`)
    return unwrap<AuditResourcesResponse>(res)
  },

  /** Federated entity history — all audit entries for one entity. */
  byEntity: async (orgId: string, resource: string, entityId: string): Promise<AuditListResponse> => {
    const params = new URLSearchParams({ resource, entity_id: entityId, take: '100' })
    const res = await apiClient.get(`${base(orgId)}?${params.toString()}`)
    return unwrap<AuditListResponse>(res)
  },
}
