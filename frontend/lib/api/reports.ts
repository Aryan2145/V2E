import apiClient from './client'
import type {
  RosterResponse,
  Scorecard,
  AllScorecardsResponse,
  ScorecardScope,
  ScorecardWindow,
  AgeingReport,
  CalendarReport,
} from '@/lib/types/reports'

const base = (orgId: string) => `/api/v1/org/${orgId}/reports`

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

function qs(params: Record<string, string | undefined | null>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, v)
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const reportsApi = {
  /** Scope-aware roster of people the viewer may open. */
  getScorecardRoster: async (orgId: string, scope?: ScorecardScope): Promise<RosterResponse> => {
    const res = await apiClient.get(`${base(orgId)}/person-scorecards${qs({ scope })}`)
    return unwrap<RosterResponse>(res)
  },

  /** One person's full scorecard (403 if outside the viewer's scope). */
  getScorecard: async (orgId: string, userId: string, window: ScorecardWindow = {}): Promise<Scorecard> => {
    const res = await apiClient.get(
      `${base(orgId)}/person-scorecards/${userId}${qs({ from_date: window.from_date, to_date: window.to_date })}`,
    )
    return unwrap<Scorecard>(res)
  },

  /** Every in-scope person's full scorecard — for "download everyone". */
  getAllScorecards: async (
    orgId: string,
    scope?: ScorecardScope,
    window: ScorecardWindow = {},
  ): Promise<AllScorecardsResponse> => {
    const res = await apiClient.get(
      `${base(orgId)}/person-scorecards/all${qs({ scope, from_date: window.from_date, to_date: window.to_date })}`,
    )
    return unwrap<AllScorecardsResponse>(res)
  },

  /** Scope-aware Pending & Overdue Ageing report (person-wise + task-wise + pending list). */
  getAgeingReport: async (orgId: string, scope?: ScorecardScope): Promise<AgeingReport> => {
    const res = await apiClient.get(`${base(orgId)}/task-ageing${qs({ scope })}`)
    return unwrap<AgeingReport>(res)
  },

  /** Scope-aware Monthly Task Compliance Calendar (one row per task+person, one column per day). */
  getTaskCalendar: async (orgId: string, month?: string, scope?: ScorecardScope): Promise<CalendarReport> => {
    const res = await apiClient.get(`${base(orgId)}/task-calendar${qs({ month, scope })}`)
    return unwrap<CalendarReport>(res)
  },
}
