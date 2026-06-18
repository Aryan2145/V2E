import apiClient from './client'
import type { AuditListResponse } from '@/lib/types/goals'

const base = (orgId: string) => `/api/v1/org/${orgId}/audit-logs`

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

export interface AuditFilters {
  resource?: string
  action?: string
  actor_user_id?: string
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
}
