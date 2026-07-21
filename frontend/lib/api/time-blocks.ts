import apiClient from './client'

// A personal Time-Block (the user's own availability). 'native' = created in v2e,
// 'google' = imported from the user's Google Calendar (read-only in v2e).
export interface TimeBlock {
  id: string
  user_id: string
  organization_id: string | null
  title: string
  note: string | null
  start_at: string
  end_at: string
  all_day: boolean
  source: 'native' | 'google'
  google_event_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateTimeBlockInput {
  title: string
  note?: string
  start_at: string
  end_at: string
  all_day?: boolean
}

const base = (orgId: string) => `/api/v1/org/${orgId}/time-blocks`

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

export const timeBlocksApi = {
  list: async (orgId: string, from: string, to: string): Promise<TimeBlock[]> =>
    unwrap(await apiClient.get(`${base(orgId)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)),
  create: async (orgId: string, dto: CreateTimeBlockInput): Promise<TimeBlock> =>
    unwrap(await apiClient.post(base(orgId), dto)),
  update: async (orgId: string, id: string, dto: Partial<CreateTimeBlockInput>): Promise<TimeBlock> =>
    unwrap(await apiClient.patch(`${base(orgId)}/${id}`, dto)),
  remove: async (orgId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/${id}`)
  },
}
