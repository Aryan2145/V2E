// ─── Enum types ───────────────────────────────────────────────────────────────

export type HolidayOnTaskAction =
  | 'skip_create'
  | 'create_anyway'
  | 'move_to_prev_working_day'
  | 'move_to_next_working_day'

export type HolidayPriorityLevel = 'individual_first' | 'department_first' | 'org_first'

export type HolidayType = 'national' | 'company' | 'regional' | 'team' | 'personal' | 'leave'

export type HolidayStatus = 'active' | 'pending_review'

// ─── Master config ────────────────────────────────────────────────────────────

export interface HolidayMasterConfig {
  id: string
  organization_id: string
  country_code: string | null
  holiday_on_task_action: HolidayOnTaskAction
  priority_level: HolidayPriorityLevel
  auto_fetch_national_holidays: boolean
  pending_review_deadline_days: number
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
  effective_from: string | null
  effective_to: string | null
  created_at: string
  updated_at: string
}

// ─── Holidays ─────────────────────────────────────────────────────────────────

/** Which level an opt-out (removal) of an inherited holiday is recorded against. */
export type HolidayOptOutSource = 'org' | 'department'

/** Minimal shape the holiday list + month calendar components render (org, dept or individual). */
export interface CalendarHoliday {
  id: string
  name: string
  date: string
  end_date: string | null
  type: HolidayType
  status: HolidayStatus
  is_recurring_yearly: boolean
  /**
   * Where this row comes from relative to the viewing context:
   *   'own'        — created at this level (this dept's, or the employee's personal, holiday)
   *   'department' — inherited from an ancestor department
   *   'org'        — inherited from the organization-wide baseline
   */
  origin?: 'own' | 'department' | 'org'
  /** Set when the row is inherited (origin 'department' or 'org') — a link, not a copy. */
  inherited?: boolean
  source_department_id?: string | null
  source_department_name?: string | null
  source_department_head_user_id?: string | null
  source_department_head_name?: string | null
  /** Human label for the source ("Organization" for org-origin); null for own rows. */
  source_label?: string | null
  /** For an own holiday: how many descendant departments it cascades to. */
  cascade_target_count?: number
}

/** A single org holiday a department has removed (for the discrepancy panel). */
export interface RemovedOrgHoliday {
  org_holiday_id: string
  name: string
  date: string | null
  type: HolidayType | null
  applies_to_subtree: boolean
  opted_out_by_user_id: string
  opted_out_by_name: string | null
  created_at: string
}

/** A department that is out of sync with the org calendar, and what it removed. */
export interface HolidayDiscrepancy {
  department_id: string
  department_name: string
  removed: RemovedOrgHoliday[]
}

export interface OrgHoliday {
  id: string
  organization_id: string
  name: string
  date: string
  /** Inclusive end date for a multi-day holiday; null for single-day. */
  end_date: string | null
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
  /** Inclusive end date for a multi-day holiday; null for single-day. */
  end_date: string | null
  type: HolidayType
  status: HolidayStatus
  is_recurring_yearly: boolean
  description: string | null
  created_at: string
  updated_at: string
  /** True when this department inherits the holiday from an ancestor (cascade link). */
  inherited?: boolean
  /** Origin department of an inherited holiday; null/absent for own holidays. */
  source_department_id?: string | null
  source_department_name?: string | null
  source_department_head_user_id?: string | null
  source_department_head_name?: string | null
  /** For an own holiday: how many descendant departments it cascades to. */
  cascade_target_count?: number
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
