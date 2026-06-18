import apiClient from './client'
import type {
  CreateDemandPayload,
  DailyUpdateView,
  DayContext,
  ReadableWriter,
  WorkLogAccessConfig,
  WorkLogDemand,
  WorkLogRemark,
  WorkLogSubmission,
} from '@/lib/types/workLogs'

const base = (orgId: string) => `/api/v1/org/${orgId}/work-logs`

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

export interface UpsertDailyPayload {
  notes?: { title: string; description?: string; order_index?: number }[]
  stuck?: string
  decisions?: string
  day_summary?: string
  planning_tomorrow?: string
  folded_submissions?: { id: string; body?: string }[]
  submit?: boolean
}

export const workLogApi = {
  // ── Daily Update ──────────────────────────────────────────────────────────
  getDay: async (orgId: string, date?: string): Promise<DailyUpdateView> => {
    const res = await apiClient.get(`${base(orgId)}/daily`, { params: date ? { date } : {} })
    return unwrap<DailyUpdateView>(res)
  },
  upsertDay: async (orgId: string, payload: UpsertDailyPayload, date?: string): Promise<DailyUpdateView> => {
    const res = await apiClient.put(`${base(orgId)}/daily`, payload, { params: date ? { date } : {} })
    return unwrap<DailyUpdateView>(res)
  },
  getDayContext: async (orgId: string, date?: string): Promise<DayContext> => {
    const res = await apiClient.get(`${base(orgId)}/daily/context`, { params: date ? { date } : {} })
    return unwrap<DayContext>(res)
  },

  // ── Review ────────────────────────────────────────────────────────────────
  getReadableWriters: async (orgId: string): Promise<ReadableWriter[]> => {
    const res = await apiClient.get(`${base(orgId)}/readable-writers`)
    return unwrap<ReadableWriter[]>(res)
  },
  getWriterLogs: async (
    orgId: string,
    writerId: string,
    range?: { from?: string; to?: string },
  ): Promise<{ writer_id: string; daily_updates: DailyUpdateView['daily_update'][]; standalone_submissions: WorkLogSubmission[] }> => {
    const res = await apiClient.get(`${base(orgId)}/writer/${writerId}`, { params: range ?? {} })
    return unwrap(res)
  },
  getWriterDay: async (orgId: string, writerId: string, date: string): Promise<DailyUpdateView> => {
    const res = await apiClient.get(`${base(orgId)}/writer/${writerId}/daily`, { params: { date } })
    return unwrap<DailyUpdateView>(res)
  },

  // ── Demands ───────────────────────────────────────────────────────────────
  listDemands: async (orgId: string): Promise<WorkLogDemand[]> => {
    const res = await apiClient.get(`${base(orgId)}/demands`)
    return unwrap<WorkLogDemand[]>(res)
  },
  createDemand: async (orgId: string, payload: CreateDemandPayload): Promise<WorkLogDemand> => {
    const res = await apiClient.post(`${base(orgId)}/demands`, payload)
    return unwrap<WorkLogDemand>(res)
  },
  getDemandSeries: async (orgId: string, id: string): Promise<WorkLogDemand> => {
    const res = await apiClient.get(`${base(orgId)}/demands/${id}`)
    return unwrap<WorkLogDemand>(res)
  },
  pauseDemand: async (orgId: string, id: string): Promise<void> => {
    await apiClient.post(`${base(orgId)}/demands/${id}/pause`)
  },
  resumeDemand: async (orgId: string, id: string): Promise<void> => {
    await apiClient.post(`${base(orgId)}/demands/${id}/resume`)
  },
  deleteDemand: async (orgId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/demands/${id}`)
  },

  // ── My standalone demanded logs ─────────────────────────────────────────────
  getMySubmissions: async (orgId: string, status?: string): Promise<WorkLogSubmission[]> => {
    const res = await apiClient.get(`${base(orgId)}/my-submissions`, { params: status ? { status } : {} })
    return unwrap<WorkLogSubmission[]>(res)
  },
  submitSubmission: async (orgId: string, id: string, body?: string): Promise<WorkLogSubmission> => {
    const res = await apiClient.put(`${base(orgId)}/submissions/${id}`, { body })
    return unwrap<WorkLogSubmission>(res)
  },

  // ── Remarks ───────────────────────────────────────────────────────────────
  getRemarks: async (orgId: string, targetType: string, targetId: string): Promise<WorkLogRemark[]> => {
    const res = await apiClient.get(`${base(orgId)}/remarks`, { params: { target_type: targetType, target_id: targetId } })
    return unwrap<WorkLogRemark[]>(res)
  },
  addRemark: async (
    orgId: string,
    payload: { target_type: string; target_id: string; body: string; reply_to_remark_id?: string },
  ): Promise<WorkLogRemark> => {
    const res = await apiClient.post(`${base(orgId)}/remarks`, payload)
    return unwrap<WorkLogRemark>(res)
  },
  deleteRemark: async (orgId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/remarks/${id}`)
  },

  // ── Admin access ────────────────────────────────────────────────────────────
  getAccess: async (orgId: string): Promise<WorkLogAccessConfig> => {
    const res = await apiClient.get(`${base(orgId)}/access`)
    return unwrap<WorkLogAccessConfig>(res)
  },
  updateAccessSettings: async (
    orgId: string,
    dto: { managers_read_reports?: boolean; writer_user_ids?: string[] },
  ): Promise<WorkLogAccessConfig['settings']> => {
    const res = await apiClient.put(`${base(orgId)}/access/settings`, dto)
    return unwrap(res)
  },
  addReaderGrant: async (orgId: string, reader_user_id: string, writer_user_id: string): Promise<void> => {
    await apiClient.post(`${base(orgId)}/access/grants`, { reader_user_id, writer_user_id })
  },
  removeReaderGrant: async (orgId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/access/grants/${id}`)
  },
}
