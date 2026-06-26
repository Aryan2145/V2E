import apiClient from './client'
import type {
  Goal,
  GoalCheckIn,
  GoalLevel,
  GoalNextDefault,
  GoalPerspective,
  ScorecardQuadrant,
  CreateGoalInput,
  UpdateGoalInput,
  CreateCheckInInput,
} from '@/lib/types/goals'

const base = (orgId: string) => `/api/v1/org/${orgId}/goals`

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

export interface GoalListFilters {
  level?: GoalLevel
  perspective?: GoalPerspective
  owner_user_id?: string
  parent_goal_id?: string
  status?: string
  from_date?: string
  to_date?: string
  search?: string
}

export const goalsApi = {
  list: async (orgId: string, filters: GoalListFilters = {}): Promise<Goal[]> => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, String(v))
    })
    const qs = params.toString()
    const res = await apiClient.get(`${base(orgId)}${qs ? `?${qs}` : ''}`)
    return unwrap<Goal[]>(res)
  },

  get: async (orgId: string, id: string): Promise<Goal> => {
    const res = await apiClient.get(`${base(orgId)}/${id}`)
    return unwrap<Goal>(res)
  },

  scorecard: async (orgId: string): Promise<ScorecardQuadrant[]> => {
    const res = await apiClient.get(`${base(orgId)}/scorecard`)
    return unwrap<ScorecardQuadrant[]>(res)
  },

  nextDefault: async (orgId: string, parentId: string): Promise<GoalNextDefault> => {
    const res = await apiClient.get(`${base(orgId)}/${parentId}/next-default`)
    return unwrap<GoalNextDefault>(res)
  },

  create: async (orgId: string, dto: CreateGoalInput): Promise<Goal> => {
    const res = await apiClient.post(`${base(orgId)}`, dto)
    return unwrap<Goal>(res)
  },

  update: async (orgId: string, id: string, dto: UpdateGoalInput): Promise<Goal> => {
    const res = await apiClient.patch(`${base(orgId)}/${id}`, dto)
    return unwrap<Goal>(res)
  },

  remove: async (orgId: string, id: string, reason?: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/${id}`, { data: { reason } })
  },

  listCheckIns: async (orgId: string, goalId: string): Promise<GoalCheckIn[]> => {
    const res = await apiClient.get(`${base(orgId)}/${goalId}/check-ins`)
    return unwrap<GoalCheckIn[]>(res)
  },

  createCheckIn: async (orgId: string, goalId: string, dto: CreateCheckInInput): Promise<GoalCheckIn> => {
    const res = await apiClient.post(`${base(orgId)}/${goalId}/check-ins`, dto)
    return unwrap<GoalCheckIn>(res)
  },
}
