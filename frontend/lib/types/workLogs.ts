// Work Log (Governance) types — mirror the backend work-logs module.

export interface WorkLogNote {
  id: string
  daily_update_id: string
  title: string
  description: string | null
  order_index: number
}

export interface DailyUpdate {
  id: string
  organization_id: string
  user_id: string
  log_date: string
  stuck: string | null
  decisions: string | null
  day_summary: string | null
  planning_tomorrow: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
  notes?: WorkLogNote[]
}

export interface FoldedDemand {
  submission_id: string
  demand_id: string
  title: string
  description: string | null
  body: string | null
  status: string
}

export interface DailyUpdateView {
  date: string
  daily_update: DailyUpdate | null
  previous_planning_tomorrow: string | null
  previous_planning_date: string | null
  folded_demands: FoldedDemand[]
}

export interface DayContextTask {
  id: string
  title: string
  deadline: string | null
  status: { label: string; type: string } | null
}

export interface DayContextTicket {
  id: string
  ticket_number: string
  title: string
  raised_by_user_id: string
  assigned_to_user_id: string | null
  created_at: string
  direction: 'by_me' | 'to_me'
}

export interface DayContext {
  date: string
  tasks: DayContextTask[]
  tickets: DayContextTicket[]
}

export interface ReadableWriter {
  user_id: string
  name: string
  department_name: string | null
  role_title: string | null
}

// ─── Demands ────────────────────────────────────────────────────────────────

export type WorkLogScheduleType = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type WorkLogEndCondition = 'never' | 'on_date' | 'after_n'

export interface WorkLogDemandSchedule {
  id: string
  demand_id: string
  schedule_type: WorkLogScheduleType
  every: number
  days: number[]
  month_days: number[]
  yearly_dates: { month: number; day: number }[]
  time: string
  start_date: string
  end_condition: WorkLogEndCondition
  end_date?: string | null
  end_after?: number | null
  occurrence_count: number
  is_active: boolean
  order_index: number
}

export interface WorkLogSubmission {
  id: string
  demand_id: string
  writer_user_id: string
  due_date: string
  period_label: string
  body: string | null
  status: 'pending' | 'submitted'
  submitted_at: string | null
  daily_update_id: string | null
  created_at: string
  demand?: { id: string; title: string; description?: string | null; assigner_user_id: string }
  assigner_name?: string | null
}

export interface WorkLogDemand {
  id: string
  organization_id: string
  title: string
  description: string | null
  assigner_user_id: string
  assignee_user_id: string
  assignee_name?: string | null
  assigner_name?: string | null
  kind: 'one_time' | 'recurring'
  deadline: string | null
  is_active: boolean
  created_at: string
  schedule_entries?: WorkLogDemandSchedule[]
  submissions?: WorkLogSubmission[]
  _count?: { submissions: number }
}

export interface CreateDemandPayload {
  title: string
  description?: string
  assignee_user_id: string
  kind: 'one_time' | 'recurring'
  deadline?: string
  schedule_entries?: {
    schedule_type: WorkLogScheduleType
    every?: number
    days?: number[]
    month_days?: number[]
    yearly_dates?: { month: number; day: number }[]
    time: string
    start_date: string
    end_condition?: WorkLogEndCondition
    end_date?: string
    end_after?: number
    order_index?: number
  }[]
}

// ─── Remarks ──────────────────────────────────────────────────────────────────

export interface WorkLogRemark {
  id: string
  target_type: 'daily_update' | 'submission'
  target_id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  body: string
  reply_to_remark_id: string | null
  is_deleted: boolean
  created_at: string
  replies?: WorkLogRemark[]
}

// ─── Admin access ───────────────────────────────────────────────────────────

export interface WorkLogReaderGrant {
  id: string
  reader_user_id: string
  reader_name: string | null
  writer_user_id: string
  writer_name: string | null
}

export interface WorkLogAccessConfig {
  settings: { managers_read_reports: boolean; writer_user_ids: string[] }
  grants: WorkLogReaderGrant[]
  members: { user_id: string; name: string; department_name: string | null }[]
}
