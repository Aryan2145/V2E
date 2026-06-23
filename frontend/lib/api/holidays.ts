import apiClient from './client'
import type {
  HolidayMasterConfig,
  OrgWorkingDays,
  OrgHoliday,
  DepartmentWorkingDays,
  DepartmentHoliday,
  IndividualWorkingDays,
  IndividualHoliday,
  HolidayAuditLog,
  HolidayCheckResult,
  NonWorkingDate,
  HolidayEntityType,
  HolidayStatus,
  HolidayType,
} from '@/lib/types/holidays'

const base = (orgId: string) => `/api/v1/org/${orgId}/holidays`

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

export const holidaysApi = {
  // ─── Master ────────────────────────────────────────────────────────────────

  getConfig: async (orgId: string): Promise<HolidayMasterConfig> => {
    const res = await apiClient.get(`${base(orgId)}/master`)
    return unwrap<HolidayMasterConfig>(res)
  },

  updateConfig: async (orgId: string, dto: Partial<HolidayMasterConfig>): Promise<HolidayMasterConfig> => {
    const res = await apiClient.patch(`${base(orgId)}/master`, dto)
    return unwrap<HolidayMasterConfig>(res)
  },

  // ─── Bulk import ───────────────────────────────────────────────────────────

  bulkImportOrgHolidays: async (orgId: string, holidays: Array<{
    name: string
    date: string
    type?: string
    is_recurring_yearly?: boolean
    description?: string
  }>): Promise<{ imported: number; skipped: number }> => {
    const res = await apiClient.post(`${base(orgId)}/org/holidays/bulk-import`, { holidays })
    return unwrap<{ imported: number; skipped: number }>(res)
  },

  // ─── Org working days ──────────────────────────────────────────────────────

  getOrgWorkingDays: async (orgId: string): Promise<OrgWorkingDays> => {
    const res = await apiClient.get(`${base(orgId)}/org/working-days`)
    return unwrap<OrgWorkingDays>(res)
  },

  updateOrgWorkingDays: async (orgId: string, working_days: number[]): Promise<OrgWorkingDays> => {
    const res = await apiClient.patch(`${base(orgId)}/org/working-days`, { working_days })
    return unwrap<OrgWorkingDays>(res)
  },

  // ─── Org holidays ──────────────────────────────────────────────────────────

  listOrgHolidays: async (orgId: string, params?: { year?: number; type?: HolidayType; status?: HolidayStatus }): Promise<OrgHoliday[]> => {
    const res = await apiClient.get(`${base(orgId)}/org/holidays`, { params })
    return unwrap<OrgHoliday[]>(res)
  },

  createOrgHoliday: async (orgId: string, dto: Omit<OrgHoliday, 'id' | 'organization_id' | 'created_at' | 'updated_at'>): Promise<OrgHoliday> => {
    const res = await apiClient.post(`${base(orgId)}/org/holidays`, dto)
    return unwrap<OrgHoliday>(res)
  },

  updateOrgHoliday: async (orgId: string, id: string, dto: Partial<OrgHoliday>): Promise<OrgHoliday> => {
    const res = await apiClient.patch(`${base(orgId)}/org/holidays/${id}`, dto)
    return unwrap<OrgHoliday>(res)
  },

  deleteOrgHoliday: async (orgId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/org/holidays/${id}`)
  },

  // ─── Dept working days ─────────────────────────────────────────────────────

  getDeptWorkingDays: async (orgId: string, deptId: string): Promise<DepartmentWorkingDays | null> => {
    const res = await apiClient.get(`${base(orgId)}/dept/${deptId}/working-days`)
    return unwrap<DepartmentWorkingDays | null>(res)
  },

  upsertDeptWorkingDays: async (orgId: string, deptId: string, working_days: number[]): Promise<DepartmentWorkingDays> => {
    const res = await apiClient.patch(`${base(orgId)}/dept/${deptId}/working-days`, { working_days })
    return unwrap<DepartmentWorkingDays>(res)
  },

  deleteDeptWorkingDays: async (orgId: string, deptId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/dept/${deptId}/working-days`)
  },

  // ─── Dept holidays ─────────────────────────────────────────────────────────

  listDeptHolidays: async (orgId: string, deptId: string, params?: { year?: number }): Promise<DepartmentHoliday[]> => {
    const res = await apiClient.get(`${base(orgId)}/dept/${deptId}/holidays`, { params })
    return unwrap<DepartmentHoliday[]>(res)
  },

  createDeptHoliday: async (
    orgId: string,
    deptId: string,
    dto: Omit<DepartmentHoliday, 'id' | 'organization_id' | 'department_id' | 'created_at' | 'updated_at'>
      & { target_department_ids?: string[] },
  ): Promise<DepartmentHoliday> => {
    const res = await apiClient.post(`${base(orgId)}/dept/${deptId}/holidays`, dto)
    return unwrap<DepartmentHoliday>(res)
  },

  updateDeptHoliday: async (
    orgId: string,
    deptId: string,
    id: string,
    dto: Partial<DepartmentHoliday> & { target_department_ids?: string[] },
  ): Promise<DepartmentHoliday> => {
    const res = await apiClient.patch(`${base(orgId)}/dept/${deptId}/holidays/${id}`, dto)
    return unwrap<DepartmentHoliday>(res)
  },

  deleteDeptHoliday: async (orgId: string, deptId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/dept/${deptId}/holidays/${id}`)
  },

  /** Opt this department (and its descendants) out of an inherited holiday — a local detach. */
  optOutDeptHoliday: async (orgId: string, deptId: string, id: string): Promise<void> => {
    await apiClient.post(`${base(orgId)}/dept/${deptId}/holidays/${id}/opt-out`)
  },

  /** Reverse a local opt-out (re-attach the inherited holiday). */
  undoOptOutDeptHoliday: async (orgId: string, deptId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/dept/${deptId}/holidays/${id}/opt-out`)
  },

  // ─── Individual working days ───────────────────────────────────────────────

  listUserWorkingDays: async (orgId: string, userId: string): Promise<IndividualWorkingDays[]> => {
    const res = await apiClient.get(`${base(orgId)}/user/${userId}/working-days`)
    return unwrap<IndividualWorkingDays[]>(res)
  },

  createUserWorkingDays: async (orgId: string, userId: string, dto: Omit<IndividualWorkingDays, 'id' | 'organization_id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<IndividualWorkingDays> => {
    const res = await apiClient.post(`${base(orgId)}/user/${userId}/working-days`, dto)
    return unwrap<IndividualWorkingDays>(res)
  },

  updateUserWorkingDays: async (orgId: string, userId: string, id: string, dto: Partial<IndividualWorkingDays>): Promise<IndividualWorkingDays> => {
    const res = await apiClient.patch(`${base(orgId)}/user/${userId}/working-days/${id}`, dto)
    return unwrap<IndividualWorkingDays>(res)
  },

  deleteUserWorkingDays: async (orgId: string, userId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/user/${userId}/working-days/${id}`)
  },

  // ─── Individual holidays ───────────────────────────────────────────────────

  listUserHolidays: async (orgId: string, userId: string, params?: { year?: number }): Promise<IndividualHoliday[]> => {
    const res = await apiClient.get(`${base(orgId)}/user/${userId}/holidays`, { params })
    return unwrap<IndividualHoliday[]>(res)
  },

  createUserHoliday: async (orgId: string, userId: string, dto: Omit<IndividualHoliday, 'id' | 'organization_id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<IndividualHoliday> => {
    const res = await apiClient.post(`${base(orgId)}/user/${userId}/holidays`, dto)
    return unwrap<IndividualHoliday>(res)
  },

  updateUserHoliday: async (orgId: string, userId: string, id: string, dto: Partial<IndividualHoliday>): Promise<IndividualHoliday> => {
    const res = await apiClient.patch(`${base(orgId)}/user/${userId}/holidays/${id}`, dto)
    return unwrap<IndividualHoliday>(res)
  },

  deleteUserHoliday: async (orgId: string, userId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/user/${userId}/holidays/${id}`)
  },

  // ─── Utility ───────────────────────────────────────────────────────────────

  checkDate: async (orgId: string, date: string, params?: { userId?: string; deptId?: string }): Promise<HolidayCheckResult> => {
    const res = await apiClient.get(`${base(orgId)}/check`, { params: { date, ...params } })
    return unwrap<HolidayCheckResult>(res)
  },

  getRange: async (orgId: string, from: string, to: string, params?: { userId?: string; deptId?: string }): Promise<{ non_working_dates: NonWorkingDate[] }> => {
    const res = await apiClient.get(`${base(orgId)}/range`, { params: { from, to, ...params } })
    return unwrap<{ non_working_dates: NonWorkingDate[] }>(res)
  },

  getAuditLog: async (orgId: string, params?: { year?: number; entity_type?: HolidayEntityType; from?: string; to?: string }): Promise<HolidayAuditLog[]> => {
    const res = await apiClient.get(`${base(orgId)}/audit`, { params })
    return unwrap<HolidayAuditLog[]>(res)
  },
}
