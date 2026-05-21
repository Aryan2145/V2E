// ─── Enum types ───────────────────────────────────────────────────────────────

export type HolidayOnTaskAction =
  | 'skip_create'
  | 'create_anyway'
  | 'move_to_prev_working_day'
  | 'move_to_next_working_day'

export type HolidayPriorityLevel = 'individual_first' | 'department_first' | 'org_first'

export type HolidayType = 'national' | 'company' | 'regional' | 'team' | 'personal' | 'leave'

export type HolidayStatus = 'active' | 'pending_review'

export type HolidayAuditAction = 'moved_forward' | 'moved_backward' | 'skipped' | 'created_anyway'

export type HolidayEntityType = 'task' | 'recurring_task' | 'workflow_step' | 'ticket'

// ─── Master config ────────────────────────────────────────────────────────────

export interface HolidayMasterConfig {
  id: string
  organization_id: string
  country_code: string | null
  holiday_on_task_action: HolidayOnTaskAction
  priority_level: HolidayPriorityLevel
  auto_fetch_national_holidays: boolean
  pending_review_deadline_days: number
  org_manage_roles: string[]
  dept_manage_roles: string[]
  individual_manage_roles: string[]
  created_at: string
  updated_at: string
}

// ─── Working days ─────────────────────────────────────────────────────────────

export interface OrgWorkingDays {
  id: string
  organization_id: string
  working_days: number[]
  created_at: string
  updated_at: string
}

export interface DepartmentWorkingDays {
  id: string
  organization_id: string
  department_id: string
  working_days: number[]
  created_at: string
  updated_at: string
}

export interface IndividualWorkingDays {
  id: string
  organization_id: string
  user_id: string
  working_days: number[]
  valid_from: string | null
  valid_to: string | null
  created_at: string
  updated_at: string
}

// ─── Holidays ─────────────────────────────────────────────────────────────────

export interface OrgHoliday {
  id: string
  organization_id: string
  name: string
  date: string
  type: HolidayType
  status: HolidayStatus
  is_recurring_yearly: boolean
  description: string | null
  source: string | null
  created_at: string
  updated_at: string
}

export interface DepartmentHoliday {
  id: string
  organization_id: string
  department_id: string
  name: string
  date: string
  type: HolidayType
  status: HolidayStatus
  is_recurring_yearly: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export interface IndividualHoliday {
  id: string
  organization_id: string
  user_id: string
  name: string
  date: string
  type: HolidayType
  status: HolidayStatus
  is_recurring_yearly: boolean
  description: string | null
  created_at: string
  updated_at: string
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export interface HolidayAuditLog {
  id: string
  organization_id: string
  entity_type: HolidayEntityType
  entity_id: string
  entity_title: string | null
  original_date: string
  adjusted_date: string | null
  action: HolidayAuditAction
  holiday_name: string | null
  created_at: string
}

// ─── Nager.Date ───────────────────────────────────────────────────────────────

export interface NagerCountry {
  countryCode: string
  name: string
}

export interface NagerHoliday {
  date: string
  name: string
  localName: string
  countryCode: string
  global: boolean
  types: string[]
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export interface HolidayCheckResult {
  is_working_day: boolean
  reason: string | null
  adjusted_date: string | null
  action: HolidayOnTaskAction
}

export interface NonWorkingDate {
  date: string
  name: string
  level: 'org' | 'department' | 'individual'
  type: HolidayType
}
