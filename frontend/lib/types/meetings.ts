export type MeetingType = 'online' | 'offline' | 'hybrid'
export type MeetingMode = 'fixed' | 'poll'
export type MeetingStatus = 'polling' | 'scheduled' | 'in_progress' | 'closed' | 'cancelled'
export type MeetingLinkType = 'goal' | 'project' | 'task' | 'ticket'
export type MeetingAttendeeResponse = 'pending' | 'accepted' | 'rejected' | 'reschedule_requested'
export type MeetingSlotSource = 'caller' | 'invitee' | 'system'
export type MeetingVote = 'available' | 'unavailable' | 'maybe'

export interface UserLite {
  id: string
  name: string
  email?: string
}

export interface MeetingAttendee {
  id: string
  meeting_id: string
  user_id: string
  is_organizer: boolean
  response: MeetingAttendeeResponse
  reject_reason: string | null
  reschedule_at: string | null
  reschedule_note: string | null
  attended: boolean
  attended_in_at: string | null
  attended_out_at: string | null
  user?: UserLite
}

export interface MeetingSlotVoteRow {
  id: string
  slot_id: string
  user_id: string
  vote: MeetingVote
}

export interface MeetingSlot {
  id: string
  meeting_id: string
  start_at: string
  end_at: string
  source: MeetingSlotSource
  proposed_by_user_id: string | null
  system_rank: number | null
  is_dismissed: boolean
  is_confirmed: boolean
  votes?: MeetingSlotVoteRow[]
}

export interface MeetingActionItem {
  id: string
  meeting_id: string
  text: string
  owner_user_id: string | null
  due_date: string | null
  linked_task_id: string | null
  is_done: boolean
}

export interface MeetingDecision {
  id: string
  meeting_id: string
  decision: string
  owner_user_id: string | null
  decided_on: string
  reason: string | null
  affects_link_type: MeetingLinkType | null
  affects_entity_id: string | null
  meeting?: { id: string; title: string }
}

export interface MeetingConflict {
  user_id: string
  meeting_id: string
  title: string
  scheduled_start: string | null
}

export interface Meeting {
  id: string
  organization_id: string
  title: string
  type: MeetingType
  online_link: string | null
  online_password: string | null
  location: string | null
  mode: MeetingMode
  status: MeetingStatus
  link_type: MeetingLinkType | null
  link_entity_id: string | null
  agenda: string | null
  minutes: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  actual_start: string | null
  actual_end: string | null
  poll_window_start: string | null
  poll_window_end: string | null
  poll_duration_min: number | null
  created_by_user_id: string
  created_at: string
  updated_at: string
  organizer?: UserLite
  attendees?: MeetingAttendee[]
  slots?: MeetingSlot[]
  action_items?: MeetingActionItem[]
  decisions?: MeetingDecision[]
  _count?: { attendees?: number; action_items?: number; decisions?: number }
  // detail-only
  my_note?: string
  can_convert_to_poll?: boolean
  conflicts?: MeetingConflict[]
  can_manage?: boolean
}

export interface MeetingAnalytics {
  planned_minutes: number | null
  actual_minutes: number | null
  overrun_minutes: number | null
  attendance: { invited: number; accepted: number; attended: number; late: number; no_show: number }
  action_items: { created: number; linked: number; done: number }
  decisions: number
  linkage: string
  started_on_time: boolean | null
}

export interface MeetingReport {
  activity: {
    meetings_count: number
    total_hours: number
    avg_duration_min: number
    avg_overrun_min: number
    load_per_person: { user_id: string; meetings: number }[]
  }
  attendance: { attendance_rate: number; no_show_rate: number; started_on_time_rate: number }
  output: {
    decisions_total: number
    decisions_per_meeting: number
    zero_decision_meetings: number
    action_items_created: number
    pct_linked_to_tasks: number
    pct_linked_tasks_completed: number
  }
  linkage: {
    hours_by_type: { type: string; hours: number }[]
    goal_attention: { goal_id: string; meetings: number; hours: number }[]
  }
}

// ─── Labels & palette (DESIGN_RULES badge colors) ──────────────────────────────
export const MEETING_STATUS_META: Record<MeetingStatus, { label: string; bg: string; text: string; border: string }> = {
  polling: { label: 'Polling', bg: '#FEF9C3', text: '#CA8A04', border: '#FDE68A' },
  scheduled: { label: 'Scheduled', bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  in_progress: { label: 'In progress', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  closed: { label: 'Closed', bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  cancelled: { label: 'Cancelled', bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
}

export const RESPONSE_META: Record<MeetingAttendeeResponse, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: '#F1F5F9', text: '#475569' },
  accepted: { label: 'Accepted', bg: '#DCFCE7', text: '#16A34A' },
  rejected: { label: 'Declined', bg: '#FEE2E2', text: '#DC2626' },
  reschedule_requested: { label: 'Reschedule', bg: '#FEF9C3', text: '#CA8A04' },
}

export const TYPE_LABEL: Record<MeetingType, string> = { online: 'Online', offline: 'Offline', hybrid: 'Hybrid' }
export const LINK_TYPE_LABEL: Record<MeetingLinkType, string> = { goal: 'Goal', project: 'Project', task: 'Task', ticket: 'Ticket' }
