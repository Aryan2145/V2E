import apiClient from './client'
import type {
  Meeting,
  MeetingAnalytics,
  MeetingDecision,
  MeetingReport,
  MeetingType,
  MeetingMode,
  MeetingLinkType,
  MeetingVote,
} from '@/lib/types/meetings'

const base = (orgId: string) => `/api/v1/org/${orgId}/meetings`

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

function qs(filters?: Record<string, string | undefined>): string {
  if (!filters) return ''
  const p = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v) p.set(k, v)
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

export interface CreateMeetingInput {
  title: string
  type: MeetingType
  mode: MeetingMode
  online_link?: string
  online_password?: string
  location?: string
  link_type?: MeetingLinkType
  link_entity_id?: string
  attendee_user_ids?: string[]
  agenda?: string
  minutes?: string
  scheduled_start?: string
  scheduled_end?: string
  poll_window_start?: string
  poll_window_end?: string
  poll_duration_min?: number
  slots?: { start_at: string; end_at: string }[]
  log_past?: boolean
  actual_start?: string
  actual_end?: string
}

export const meetingsApi = {
  list: async (orgId: string, filters?: Record<string, string | undefined>): Promise<Meeting[]> =>
    unwrap(await apiClient.get(`${base(orgId)}${qs(filters)}`)),

  get: async (orgId: string, id: string): Promise<Meeting> =>
    unwrap(await apiClient.get(`${base(orgId)}/${id}`)),

  create: async (orgId: string, dto: CreateMeetingInput): Promise<Meeting> =>
    unwrap(await apiClient.post(`${base(orgId)}`, dto)),

  update: async (orgId: string, id: string, dto: Partial<CreateMeetingInput>): Promise<Meeting> =>
    unwrap(await apiClient.patch(`${base(orgId)}/${id}`, dto)),

  remove: async (orgId: string, id: string, reason?: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/${id}`, { data: { reason } })
  },

  updateRecord: async (orgId: string, id: string, dto: { agenda?: string; minutes?: string }): Promise<Meeting> =>
    unwrap(await apiClient.put(`${base(orgId)}/${id}/record`, dto)),

  // scheduling
  respond: async (
    orgId: string,
    id: string,
    dto: { action: 'accept' | 'reject' | 'reschedule'; reason?: string; reschedule_at?: string; reschedule_note?: string },
  ): Promise<Meeting> => unwrap(await apiClient.post(`${base(orgId)}/${id}/respond`, dto)),

  convertToPoll: async (orgId: string, id: string): Promise<Meeting> =>
    unwrap(await apiClient.post(`${base(orgId)}/${id}/convert-to-poll`)),

  addSlot: async (orgId: string, id: string, dto: { start_at: string; end_at: string }): Promise<Meeting> =>
    unwrap(await apiClient.post(`${base(orgId)}/${id}/slots`, dto)),

  dismissSlot: async (orgId: string, id: string, slotId: string): Promise<Meeting> =>
    unwrap(await apiClient.delete(`${base(orgId)}/${id}/slots/${slotId}`)),

  voteSlot: async (orgId: string, id: string, slotId: string, vote: MeetingVote): Promise<Meeting> =>
    unwrap(await apiClient.post(`${base(orgId)}/${id}/slots/${slotId}/vote`, { vote })),

  confirmSlot: async (orgId: string, id: string, slotId: string): Promise<Meeting> =>
    unwrap(await apiClient.post(`${base(orgId)}/${id}/confirm-slot`, { slot_id: slotId })),

  // lifecycle
  start: async (orgId: string, id: string): Promise<Meeting> => unwrap(await apiClient.post(`${base(orgId)}/${id}/start`)),
  end: async (orgId: string, id: string): Promise<Meeting> => unwrap(await apiClient.post(`${base(orgId)}/${id}/end`)),
  close: async (orgId: string, id: string): Promise<Meeting> => unwrap(await apiClient.post(`${base(orgId)}/${id}/close`)),
  cancel: async (orgId: string, id: string, reason?: string): Promise<Meeting> =>
    unwrap(await apiClient.post(`${base(orgId)}/${id}/cancel`, { reason })),
  reopen: async (orgId: string, id: string): Promise<Meeting> =>
    unwrap(await apiClient.post(`${base(orgId)}/${id}/reopen`)),

  markAttendance: async (
    orgId: string,
    id: string,
    rows: { user_id: string; attended: boolean; attended_in_at?: string; attended_out_at?: string }[],
  ): Promise<Meeting> => unwrap(await apiClient.post(`${base(orgId)}/${id}/attendance`, { rows })),

  saveMyNote: async (orgId: string, id: string, body: string): Promise<void> => {
    await apiClient.put(`${base(orgId)}/${id}/my-note`, { body })
  },

  // action items
  addActionItem: async (orgId: string, id: string, dto: { text: string; owner_user_id?: string; due_date?: string }): Promise<Meeting> =>
    unwrap(await apiClient.post(`${base(orgId)}/${id}/action-items`, dto)),
  updateActionItem: async (orgId: string, id: string, itemId: string, dto: Record<string, unknown>): Promise<Meeting> =>
    unwrap(await apiClient.patch(`${base(orgId)}/${id}/action-items/${itemId}`, dto)),
  deleteActionItem: async (orgId: string, id: string, itemId: string): Promise<Meeting> =>
    unwrap(await apiClient.delete(`${base(orgId)}/${id}/action-items/${itemId}`)),
  linkTask: async (
    orgId: string,
    id: string,
    itemId: string,
    dto: { task_id?: string; create?: { title: string; assignee_user_ids: string[]; deadline?: string } },
  ): Promise<Meeting> => unwrap(await apiClient.post(`${base(orgId)}/${id}/action-items/${itemId}/link-task`, dto)),

  // decisions
  addDecision: async (orgId: string, id: string, dto: Record<string, unknown>): Promise<Meeting> =>
    unwrap(await apiClient.post(`${base(orgId)}/${id}/decisions`, dto)),
  updateDecision: async (orgId: string, id: string, decisionId: string, dto: Record<string, unknown>): Promise<Meeting> =>
    unwrap(await apiClient.patch(`${base(orgId)}/${id}/decisions/${decisionId}`, dto)),
  deleteDecision: async (orgId: string, id: string, decisionId: string): Promise<Meeting> =>
    unwrap(await apiClient.delete(`${base(orgId)}/${id}/decisions/${decisionId}`)),

  // reads
  analytics: async (orgId: string, id: string): Promise<MeetingAnalytics> =>
    unwrap(await apiClient.get(`${base(orgId)}/${id}/analytics`)),
  editLog: async (orgId: string, id: string): Promise<{ items: any[]; total: number }> =>
    unwrap(await apiClient.get(`${base(orgId)}/${id}/edit-log`)),
  report: async (orgId: string, filters?: Record<string, string | undefined>): Promise<MeetingReport> =>
    unwrap(await apiClient.get(`${base(orgId)}/reports${qs(filters)}`)),
  decisionLog: async (orgId: string, filters?: Record<string, string | undefined>): Promise<MeetingDecision[]> =>
    unwrap(await apiClient.get(`${base(orgId)}/decisions${qs(filters)}`)),
}
