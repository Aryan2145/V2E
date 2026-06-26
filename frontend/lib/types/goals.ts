// ─── Goals domain types (mirror backend Prisma enums) ─────────────────────────

export type GoalLevel = 'objective' | 'annual' | 'quarterly'
export type GoalPerspective = 'financial' | 'customer' | 'internal_process' | 'learning_growth'
export type GoalStatus = 'not_started' | 'on_track' | 'at_risk' | 'achieved' | 'archived'
export type GoalConfidence = 'on_track' | 'at_risk' | 'off_track'
export type GoalCadence = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'

export interface MeasureCheckIn {
  id: string
  goal_check_in_id: string
  goal_measure_id: string
  value: string
  created_at: string
}

export interface GoalMeasure {
  id: string
  goal_id: string
  name: string
  target_value: string
  current_value?: string | null
  unit?: string | null
  /** Time-series of recorded actuals (present on the detail endpoint). */
  check_ins?: MeasureCheckIn[]
}

export interface GoalCheckIn {
  id: string
  goal_id: string
  check_in_date: string
  confidence: GoalConfidence
  progress_percent: number
  status_note?: string | null
  created_by_user_id: string
  created_at: string
  created_by?: { id: string; name: string }
  measure_values?: MeasureCheckIn[]
}

export interface GoalOwnerLite {
  id: string
  name: string
  email?: string
}

export interface Goal {
  id: string
  organization_id: string
  level: GoalLevel
  parent_goal_id: string | null
  perspective: GoalPerspective | null
  title: string
  description: string | null
  owner_user_id: string
  department_id: string | null
  start_date: string | null
  due_date: string
  status: GoalStatus
  progress_percent: number
  review_cadence: GoalCadence
  next_review_date: string | null
  last_check_in_at: string | null
  last_confidence: GoalConfidence | null
  created_at: string
  updated_at: string
  owner?: GoalOwnerLite
  department?: { id: string; name: string } | null
  measures?: GoalMeasure[]
  check_ins?: GoalCheckIn[]
  parent?: Goal | null
  children?: Goal[]
  tasks?: any[]
  _count?: { children?: number; measures?: number }
}

export interface GoalNextDefault {
  child_level: GoalLevel
  is_first: boolean
  suggested: string | null
  clamped: boolean
  min_date: string
  max_date: string
  parent_due_date: string
  perspective: GoalPerspective | null
}

export interface ScorecardQuadrant {
  perspective: GoalPerspective
  goal_count: number
  average_progress: number
}

export interface GoalMeasureInput {
  id?: string
  name: string
  target_value: string
  current_value?: string
  unit?: string
}

export interface CreateGoalInput {
  level: GoalLevel
  parent_goal_id?: string
  perspective?: GoalPerspective
  title: string
  description?: string
  owner_user_id: string
  department_id?: string
  start_date?: string
  due_date: string
  status?: GoalStatus
  review_cadence?: GoalCadence
  measures?: GoalMeasureInput[]
}

export type UpdateGoalInput = Partial<Omit<CreateGoalInput, 'level' | 'parent_goal_id' | 'perspective'>>

export interface CreateCheckInInput {
  check_in_date: string
  confidence: GoalConfidence
  status_note?: string
  values?: Array<{ goal_measure_id: string; value: string }>
}

// ─── Labels & palette (driven by DESIGN_RULES status/badge colors) ─────────────

export const PERSPECTIVE_META: Record<
  GoalPerspective,
  { label: string; short: string; bg: string; text: string; border: string; accent: string }
> = {
  financial: { label: 'Financial', short: 'FIN', bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0', accent: '#16A34A' },
  customer: { label: 'Customer', short: 'CUST', bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD', accent: '#0891B2' },
  internal_process: { label: 'Internal Process', short: 'PROC', bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE', accent: '#7C3AED' },
  learning_growth: { label: 'Learning & Growth', short: 'L&G', bg: '#FEF9C3', text: '#CA8A04', border: '#FDE68A', accent: '#D97706' },
}

export const STATUS_META: Record<GoalStatus, { label: string; bg: string; text: string; border: string }> = {
  not_started: { label: 'Not started', bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  on_track: { label: 'On track', bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  at_risk: { label: 'At risk', bg: '#FEF9C3', text: '#CA8A04', border: '#FDE68A' },
  achieved: { label: 'Achieved', bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  archived: { label: 'Archived', bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
}

export const LEVEL_META: Record<GoalLevel, { label: string; plural: string; child: GoalLevel | null }> = {
  objective: { label: 'Objective', plural: 'Objectives', child: 'annual' },
  annual: { label: 'Goal', plural: 'Goals', child: 'quarterly' },
  quarterly: { label: 'Sub-goal', plural: 'Sub-goals', child: null },
}

// Owner's RAG confidence call — the human read recorded at each check-in.
export const CONFIDENCE_META: Record<
  GoalConfidence,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  on_track: { label: 'On track', bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0', dot: '#16A34A' },
  at_risk: { label: 'At risk', bg: '#FEF9C3', text: '#CA8A04', border: '#FDE68A', dot: '#D97706' },
  off_track: { label: 'Off track', bg: '#FEE2E2', text: '#DC2626', border: '#FECACA', dot: '#DC2626' },
}

export const CADENCE_META: Record<GoalCadence, { label: string; short: string }> = {
  none: { label: 'No set cadence', short: 'Ad-hoc' },
  weekly: { label: 'Weekly', short: 'Weekly' },
  biweekly: { label: 'Every 2 weeks', short: 'Biweekly' },
  monthly: { label: 'Monthly', short: 'Monthly' },
  quarterly: { label: 'Quarterly', short: 'Quarterly' },
}

export const CADENCE_OPTIONS: GoalCadence[] = ['none', 'weekly', 'biweekly', 'monthly', 'quarterly']

// ─── Access Rights & Audit ─────────────────────────────────────────────────────

export interface ResourcePermission {
  resource: string
  label: string
  description: string
  can_read: boolean
  can_write: boolean
  can_edit: boolean
  can_delete: boolean
}

export interface AccessMatrix {
  resources: Array<{ key: string; label: string; description: string }>
  roles: string[]
  matrix: Array<{ role: string; resources: ResourcePermission[] }>
  admin: { role: string; locked: boolean; note: string }
}

export interface MyPermissions {
  resources: Record<string, { read: boolean; write: boolean; edit: boolean; delete: boolean }>
  can_manage_access_rights: boolean
}

// AuditEntry / AuditListResponse moved to '@/lib/types/audit'.
export type { AuditEntry, AuditListResponse } from './audit'
