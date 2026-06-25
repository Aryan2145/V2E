import apiClient from './client'
import type {
  Task,
  TaskMasterConfig,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  TaskComment,
  TaskActivityLog,
  TaskChecklistItem,
  RecurringTemplate,
  RecurringScheduleEntry,
  TaskArchiveItem,
  ChecklistTemplate,
  ChecklistTemplateInput,
  TaskReportData,
  CollectiveOrgTasks,
} from '@/lib/types/tasks'

const base = (orgId: string) => `/api/v1/org/${orgId}/tasks`

// ─── Response unwrapper ───────────────────────────────────────────────────────

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

// ─── Tasks API ────────────────────────────────────────────────────────────────

export const tasksApi = {
  // ── Masters ─────────────────────────────────────────────────────────────────

  getConfig: async (orgId: string): Promise<TaskMasterConfig> => {
    const res = await apiClient.get(`${base(orgId)}/masters/config`)
    return unwrap<TaskMasterConfig>(res)
  },

  updateConfig: async (orgId: string, dto: Partial<TaskMasterConfig>): Promise<TaskMasterConfig> => {
    const res = await apiClient.patch(`${base(orgId)}/masters/config`, dto)
    return unwrap<TaskMasterConfig>(res)
  },

  getCategories: async (orgId: string): Promise<TaskCategory[]> => {
    const res = await apiClient.get(`${base(orgId)}/masters/categories`)
    return unwrap<TaskCategory[]>(res)
  },

  createCategory: async (orgId: string, dto: Omit<TaskCategory, 'id' | 'organization_id' | 'created_at'>): Promise<TaskCategory> => {
    const res = await apiClient.post(`${base(orgId)}/masters/categories`, dto)
    return unwrap<TaskCategory>(res)
  },

  updateCategory: async (orgId: string, id: string, dto: Partial<TaskCategory>): Promise<TaskCategory> => {
    const res = await apiClient.patch(`${base(orgId)}/masters/categories/${id}`, dto)
    return unwrap<TaskCategory>(res)
  },

  deleteCategory: async (orgId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/masters/categories/${id}`)
  },

  getPriorities: async (orgId: string): Promise<TaskPriority[]> => {
    const res = await apiClient.get(`${base(orgId)}/masters/priorities`)
    return unwrap<TaskPriority[]>(res)
  },

  createPriority: async (orgId: string, dto: Omit<TaskPriority, 'id' | 'organization_id'>): Promise<TaskPriority> => {
    const res = await apiClient.post(`${base(orgId)}/masters/priorities`, dto)
    return unwrap<TaskPriority>(res)
  },

  updatePriority: async (orgId: string, id: string, dto: Partial<TaskPriority>): Promise<TaskPriority> => {
    const res = await apiClient.patch(`${base(orgId)}/masters/priorities/${id}`, dto)
    return unwrap<TaskPriority>(res)
  },

  deletePriority: async (orgId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/masters/priorities/${id}`)
  },

  reorderPriorities: async (orgId: string, items: { id: string; order_index: number }[]): Promise<TaskPriority[]> => {
    const res = await apiClient.patch(`${base(orgId)}/masters/priorities/reorder`, { items })
    return unwrap<TaskPriority[]>(res)
  },

  getStatuses: async (orgId: string): Promise<TaskStatus[]> => {
    const res = await apiClient.get(`${base(orgId)}/masters/statuses`)
    return unwrap<TaskStatus[]>(res)
  },

  createStatus: async (orgId: string, dto: Omit<TaskStatus, 'id' | 'organization_id'>): Promise<TaskStatus> => {
    const res = await apiClient.post(`${base(orgId)}/masters/statuses`, dto)
    return unwrap<TaskStatus>(res)
  },

  updateStatus: async (orgId: string, id: string, dto: Partial<TaskStatus>): Promise<TaskStatus> => {
    const res = await apiClient.patch(`${base(orgId)}/masters/statuses/${id}`, dto)
    return unwrap<TaskStatus>(res)
  },

  deleteStatus: async (orgId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/masters/statuses/${id}`)
  },

  reorderStatuses: async (orgId: string, items: { id: string; order_index: number }[]): Promise<TaskStatus[]> => {
    const res = await apiClient.patch(`${base(orgId)}/masters/statuses/reorder`, { items })
    return unwrap<TaskStatus[]>(res)
  },

  getChecklistTemplates: async (orgId: string): Promise<ChecklistTemplate[]> => {
    const res = await apiClient.get(`${base(orgId)}/masters/checklist-templates`)
    return unwrap<ChecklistTemplate[]>(res)
  },

  // Templates the current user is allowed to apply when creating a task.
  getAccessibleChecklistTemplates: async (orgId: string): Promise<ChecklistTemplate[]> => {
    const res = await apiClient.get(`${base(orgId)}/masters/checklist-templates/accessible`)
    return unwrap<ChecklistTemplate[]>(res)
  },

  createChecklistTemplate: async (orgId: string, dto: ChecklistTemplateInput): Promise<ChecklistTemplate> => {
    const res = await apiClient.post(`${base(orgId)}/masters/checklist-templates`, dto)
    return unwrap<ChecklistTemplate>(res)
  },

  updateChecklistTemplate: async (orgId: string, id: string, dto: Partial<ChecklistTemplateInput>): Promise<ChecklistTemplate> => {
    const res = await apiClient.patch(`${base(orgId)}/masters/checklist-templates/${id}`, dto)
    return unwrap<ChecklistTemplate>(res)
  },

  deleteChecklistTemplate: async (orgId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/masters/checklist-templates/${id}`)
  },

  // ── Tasks ────────────────────────────────────────────────────────────────────

  listTasks: async (orgId: string, filters?: Record<string, string>): Promise<Task[]> => {
    const params = filters ? new URLSearchParams(filters).toString() : ''
    const res = await apiClient.get(`${base(orgId)}${params ? `?${params}` : ''}`)
    return unwrap<Task[]>(res)
  },

  getMyTasks: async (orgId: string): Promise<Task[]> => {
    const res = await apiClient.get(`${base(orgId)}/my`)
    return unwrap<Task[]>(res)
  },

  getMyCCTasks: async (orgId: string): Promise<Task[]> => {
    const res = await apiClient.get(`${base(orgId)}/cc`)
    return unwrap<Task[]>(res)
  },

  getAssignedByMe: async (orgId: string): Promise<Task[]> => {
    const res = await apiClient.get(`${base(orgId)}/assigned-by-me`)
    return unwrap<Task[]>(res)
  },

  getEscalated: async (orgId: string): Promise<Task[]> => {
    const res = await apiClient.get(`${base(orgId)}/escalated`)
    return unwrap<Task[]>(res)
  },

  createTask: async (orgId: string, dto: {
    title: string
    description?: string
    quadrant?: string
    priority_id?: string
    category_id?: string
    status_id?: string
    deadline?: string
    completion_mode?: string
    proof_required?: boolean
    assignee_user_ids?: string[]
    cc_user_ids?: string[]
    checklist_items?: { title: string; order_index: number }[]
    checklist_template_id?: string
    goal_id?: string
  }): Promise<Task> => {
    const res = await apiClient.post(`${base(orgId)}`, dto)
    return unwrap<Task>(res)
  },

  getTask: async (orgId: string, taskId: string): Promise<Task> => {
    const res = await apiClient.get(`${base(orgId)}/${taskId}`)
    return unwrap<Task>(res)
  },

  updateTask: async (orgId: string, taskId: string, dto: Partial<Task>): Promise<Task> => {
    const res = await apiClient.patch(`${base(orgId)}/${taskId}`, dto)
    return unwrap<Task>(res)
  },

  deleteTask: async (orgId: string, taskId: string, reason?: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/${taskId}`, { data: { reason } })
  },

  completeTask: async (orgId: string, taskId: string): Promise<Task> => {
    const res = await apiClient.post(`${base(orgId)}/${taskId}/complete`)
    return unwrap<Task>(res)
  },

  reopenTask: async (orgId: string, taskId: string, reason?: string): Promise<Task> => {
    const res = await apiClient.post(`${base(orgId)}/${taskId}/reopen`, { reason })
    return unwrap<Task>(res)
  },

  submitProof: async (orgId: string, taskId: string, proof_url: string): Promise<Task> => {
    const res = await apiClient.post(`${base(orgId)}/${taskId}/proof`, { proof_url })
    return unwrap<Task>(res)
  },

  getLogs: async (orgId: string, taskId: string): Promise<TaskActivityLog[]> => {
    const res = await apiClient.get(`${base(orgId)}/${taskId}/logs`)
    return unwrap<TaskActivityLog[]>(res)
  },

  getComments: async (orgId: string, taskId: string): Promise<TaskComment[]> => {
    const res = await apiClient.get(`${base(orgId)}/${taskId}/comments`)
    return unwrap<TaskComment[]>(res)
  },

  addComment: async (orgId: string, taskId: string, body: string, reply_to?: string): Promise<TaskComment> => {
    const res = await apiClient.post(`${base(orgId)}/${taskId}/comments`, { body, reply_to_comment_id: reply_to })
    return unwrap<TaskComment>(res)
  },

  deleteComment: async (orgId: string, taskId: string, commentId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/${taskId}/comments/${commentId}`)
  },

  toggleChecklist: async (orgId: string, taskId: string, itemId: string): Promise<TaskChecklistItem> => {
    const res = await apiClient.patch(`${base(orgId)}/${taskId}/checklist/${itemId}`)
    return unwrap<TaskChecklistItem>(res)
  },

  addAssignee: async (orgId: string, taskId: string, user_id: string, is_cc: boolean): Promise<void> => {
    await apiClient.post(`${base(orgId)}/${taskId}/assignees`, { user_id, is_cc })
  },

  removeAssignee: async (orgId: string, taskId: string, userId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/${taskId}/assignees/${userId}`)
  },

  getArchive: async (orgId: string): Promise<TaskArchiveItem[]> => {
    const res = await apiClient.get(`${base(orgId)}/archive`)
    return unwrap<TaskArchiveItem[]>(res)
  },

  // ── Recurring ────────────────────────────────────────────────────────────────

  getRecurringTemplates: async (orgId: string): Promise<RecurringTemplate[]> => {
    const res = await apiClient.get(`${base(orgId)}/recurring`)
    return unwrap<RecurringTemplate[]>(res)
  },

  createRecurring: async (orgId: string, dto: {
    title: string
    description?: string
    category_id?: string
    priority_id?: string
    schedule_entries: Omit<RecurringScheduleEntry, 'id' | 'organization_id' | 'recurring_template_id' | 'occurrence_count' | 'is_active' | 'created_at' | 'updated_at'>[]
    completion_mode?: string
    proof_required?: boolean
    assignee_user_ids?: string[]
    cc_user_ids?: string[]
    department_id?: string
  }): Promise<RecurringTemplate> => {
    const res = await apiClient.post(`${base(orgId)}/recurring`, dto)
    return unwrap<RecurringTemplate>(res)
  },

  updateRecurring: async (orgId: string, id: string, dto: Partial<{
    title: string
    description: string
    category_id: string
    priority_id: string
    schedule_entries: Partial<RecurringScheduleEntry>[]
    completion_mode: string
    proof_required: boolean
    assignee_user_ids: string[]
    cc_user_ids: string[]
    department_id: string
  }>): Promise<RecurringTemplate> => {
    const res = await apiClient.patch(`${base(orgId)}/recurring/${id}`, dto)
    return unwrap<RecurringTemplate>(res)
  },

  pauseRecurring: async (orgId: string, id: string): Promise<RecurringTemplate> => {
    const res = await apiClient.post(`${base(orgId)}/recurring/${id}/pause`)
    return unwrap<RecurringTemplate>(res)
  },

  resumeRecurring: async (orgId: string, id: string): Promise<RecurringTemplate> => {
    const res = await apiClient.post(`${base(orgId)}/recurring/${id}/resume`)
    return unwrap<RecurringTemplate>(res)
  },

  spawnTodayRecurring: async (orgId: string, id: string): Promise<{ spawned: number }> => {
    const res = await apiClient.post(`${base(orgId)}/recurring/${id}/spawn-today`)
    return unwrap<{ spawned: number }>(res)
  },

  deleteRecurring: async (orgId: string, id: string, mode: 'stop' | 'delete-future' | 'delete-all' = 'stop'): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/recurring/${id}?mode=${mode}`)
  },

  getRecurringInstances: async (orgId: string, id: string): Promise<Task[]> => {
    const res = await apiClient.get(`${base(orgId)}/recurring/${id}/instances`)
    return unwrap<Task[]>(res)
  },

  getRecurringStats: async (orgId: string, id: string): Promise<{ total: number; completed: number; pending: number }> => {
    const res = await apiClient.get(`${base(orgId)}/recurring/${id}/stats`)
    return unwrap<{ total: number; completed: number; pending: number }>(res)
  },

  listScheduleEntries: async (orgId: string, templateId: string): Promise<RecurringScheduleEntry[]> => {
    const res = await apiClient.get(`${base(orgId)}/recurring/${templateId}/schedules`)
    return unwrap<RecurringScheduleEntry[]>(res)
  },

  addScheduleEntry: async (orgId: string, templateId: string, dto: Partial<RecurringScheduleEntry>): Promise<RecurringScheduleEntry> => {
    const res = await apiClient.post(`${base(orgId)}/recurring/${templateId}/schedules`, dto)
    return unwrap<RecurringScheduleEntry>(res)
  },

  updateScheduleEntry: async (orgId: string, templateId: string, entryId: string, dto: Partial<RecurringScheduleEntry>): Promise<RecurringScheduleEntry> => {
    const res = await apiClient.patch(`${base(orgId)}/recurring/${templateId}/schedules/${entryId}`, dto)
    return unwrap<RecurringScheduleEntry>(res)
  },

  deleteScheduleEntry: async (orgId: string, templateId: string, entryId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/recurring/${templateId}/schedules/${entryId}`)
  },

  getReports: async (orgId: string, params?: { from_date?: string; to_date?: string }): Promise<TaskReportData> => {
    const qs = params ? new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString() : ''
    const res = await apiClient.get(`${base(orgId)}/reports${qs ? `?${qs}` : ''}`)
    return unwrap<TaskReportData>(res)
  },

  getCollective: async (): Promise<CollectiveOrgTasks[]> => {
    const res = await apiClient.get('/api/v1/my-tasks/collective')
    return unwrap<CollectiveOrgTasks[]>(res)
  },

  getEligibleAssignees: async (orgId: string, search?: string, sort?: 'frequency' | 'workload' | 'name'): Promise<import('@/lib/types/tasks').EligibleAssigneesResponse> => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (sort) params.set('sort', sort)
    const qs = params.toString()
    const res = await apiClient.get(`${base(orgId)}/eligible-assignees${qs ? `?${qs}` : ''}`)
    return unwrap<import('@/lib/types/tasks').EligibleAssigneesResponse>(res)
  },

  updateAssigneeVisibility: async (orgId: string, dto: {
    assignee_visibility_mode?: string
    assignee_custom_rules?: Record<string, unknown>
    assignee_visibility_config_roles?: string[]
  }): Promise<void> => {
    await apiClient.patch(`${base(orgId)}/masters/assignee-visibility`, dto)
  },

  // ── Assignee Visibility (admin model) ─────────────────────────────────────────

  getAssigneeVisibility: async (orgId: string): Promise<import('@/lib/types/tasks').AssigneeVisibilityAdminView> => {
    const res = await apiClient.get(`${base(orgId)}/masters/assignee-visibility`)
    return unwrap(res)
  },

  updateAssigneeSettings: async (
    orgId: string,
    dto: Partial<import('@/lib/types/tasks').AssigneeVisibilitySettings>,
  ): Promise<import('@/lib/types/tasks').AssigneeVisibilitySettings> => {
    const res = await apiClient.put(`${base(orgId)}/masters/assignee-visibility/settings`, dto)
    return unwrap(res)
  },

  createAssigneeBridge: async (
    orgId: string,
    dto: {
      from_department_id: string
      to_department_id: string
      depth: import('@/lib/types/tasks').BridgeDepth
      include_sub_departments?: boolean
    },
  ): Promise<void> => {
    await apiClient.post(`${base(orgId)}/masters/assignee-visibility/bridges`, dto)
  },

  deleteAssigneeBridge: async (orgId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/masters/assignee-visibility/bridges/${id}`)
  },

  setDepartmentUpward: async (
    orgId: string,
    dto: { department_id: string; allow: boolean },
  ): Promise<void> => {
    await apiClient.patch(`${base(orgId)}/masters/assignee-visibility/department-upward`, dto)
  },

  setDepartmentUnify: async (
    orgId: string,
    dto: { department_id: string; unify: boolean },
  ): Promise<void> => {
    await apiClient.patch(`${base(orgId)}/masters/assignee-visibility/department-unify`, dto)
  },

  explainAssignee: async (
    orgId: string,
    userId: string,
  ): Promise<import('@/lib/types/tasks').AssigneeExplainResult> => {
    const res = await apiClient.get(
      `${base(orgId)}/masters/assignee-visibility/explain?userId=${encodeURIComponent(userId)}`,
    )
    return unwrap(res)
  },

  // ── Per-employee assignee editor (most-granular layer) ──
  getEmployeeAssigneePreview: async (
    orgId: string,
    userId: string,
    search?: string,
  ): Promise<import('@/lib/types/tasks').EmployeeAssigneePreview> => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : ''
    const res = await apiClient.get(`${base(orgId)}/eligible-assignees-for/${encodeURIComponent(userId)}${qs}`)
    return unwrap(res)
  },

  setEmployeeManualOverride: async (
    orgId: string,
    dto: { employee_user_id: string; added_user_ids: string[]; removed_user_ids: string[] },
  ): Promise<import('@/lib/types/tasks').EmployeeManualOverride> => {
    const res = await apiClient.patch(`${base(orgId)}/masters/assignee-visibility/employee-override`, dto)
    return unwrap(res)
  },
}
