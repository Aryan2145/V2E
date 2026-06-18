import apiClient from './client'
import type { AccessMatrix, MyPermissions } from '@/lib/types/goals'

const base = (orgId: string) => `/api/v1/org/${orgId}/access-rights`

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

export interface AccessRightEntry {
  role: string
  resource: string
  can_read: boolean
  can_write: boolean
  can_edit: boolean
  can_delete: boolean
}

export const accessRightsApi = {
  getMatrix: async (orgId: string): Promise<AccessMatrix> => {
    const res = await apiClient.get(`${base(orgId)}`)
    return unwrap<AccessMatrix>(res)
  },

  update: async (orgId: string, entries: AccessRightEntry[]): Promise<AccessMatrix> => {
    const res = await apiClient.put(`${base(orgId)}`, { entries })
    return unwrap<AccessMatrix>(res)
  },

  getMine: async (orgId: string): Promise<MyPermissions> => {
    const res = await apiClient.get(`${base(orgId)}/me`)
    return unwrap<MyPermissions>(res)
  },
}
