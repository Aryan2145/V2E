import apiClient from './client'

export interface ClockState {
  is_test: boolean
  ticking: boolean
  simulated_now: string
  real_now: string
  sim_epoch: string | null
  sim_anchor: string | null
  sim_replayed_until: string | null
}

const base = (orgId: string) => `/api/v1/org/${orgId}/clock`

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

export const clockApi = {
  getClock: async (orgId: string): Promise<ClockState> =>
    unwrap<ClockState>(await apiClient.get(base(orgId))),

  setClock: async (orgId: string, datetime: string): Promise<ClockState> =>
    unwrap<ClockState>(await apiClient.post(`${base(orgId)}/set`, { datetime })),

  resetClock: async (orgId: string): Promise<ClockState> =>
    unwrap<ClockState>(await apiClient.post(`${base(orgId)}/reset`, {})),
}
