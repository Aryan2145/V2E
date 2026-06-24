export type LeaveState = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type LeaveOrigin = 'requested' | 'self_declared'
export type LeaveApprovalMode = 'self_mark' | 'manager' | 'approvers' | 'manager_or_approvers'

export interface Leave {
  id: string
  organization_id: string
  user_id: string
  start_date: string
  end_date: string
  reason: string | null
  state: LeaveState
  origin: LeaveOrigin
  overridden: boolean
  decided_by_user_id: string | null
  decided_at: string | null
  decision_note: string | null
  created_by_user_id: string
  created_at: string
  updated_at: string
  applicant_name?: string
}

export interface LeaveWindow {
  start_date: string
  end_date: string
  state: LeaveState
  origin: LeaveOrigin
  overridden: boolean
}

export interface LeaveAvailabilityEntry {
  user_id: string
  name: string
  windows: LeaveWindow[]
}

export interface LeaveAvailability {
  results: LeaveAvailabilityEntry[]
}

export interface LeaveMaster {
  id: string
  organization_id: string
  approval_mode: LeaveApprovalMode
  approver_user_ids: string[]
  any_one_can_approve: boolean
  allow_override: boolean
  recurring_notice_days: number
  config_manage_roles: string[]
}
