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
  TaskArchiveItem,
  ChecklistTemplate,
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

  createChecklistTemplate: async (orgId: string, dto: Omit<ChecklistTemplate, 'id' | 'organization_id' | 'created_at'>): Promise<ChecklistTemplate> => {
    const res = await apiClient.post(`${base(orgId)}/masters/checklist-templates`, dto)
    return unwrap<ChecklistTemplate>(res)
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
    quadrant: string
    priority_id?: string
    category_id?: string
    status_id?: string
    deadline?: string
    completion_mode?: string
    proof_required?: boolean
    assignee_user_ids?: string[]
    cc_user_ids?: string[]
    checklist?: { title: string }[]
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

  reopenTask: async (orgId: string, taskId: string): Promise<Task> => {
    const res = await apiClient.post(`${base(orgId)}/${taskId}/reopen`)
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
    const res = await apiClient.post(`${base(orgId)}/${taskId}/checklist/${itemId}/toggle`)
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

  createRecurring: async (orgId: string, dto: Omit<RecurringTemplate, 'id' | 'organization_id' | 'created_at' | 'occurrence_count'>): Promise<RecurringTemplate> => {
    const res = await apiClient.post(`${base(orgId)}/recurring`, dto)
    return unwrap<RecurringTemplate>(res)
  },

  updateRecurring: async (orgId: string, id: string, dto: Partial<RecurringTemplate>): Promise<RecurringTemplate> => {
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

  deleteRecurring: async (orgId: string, id: string, mode: 'this' | 'future' | 'all'): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/recurring/${id}`, { data: { mode } })
  },

  getRecurringInstances: async (orgId: string, id: string): Promise<Task[]> => {
    const res = await apiClient.get(`${base(orgId)}/recurring/${id}/instances`)
    return unwrap<Task[]>(res)
  },

  getRecurringStats: async (orgId: string, id: string): Promise<{ total: number; completed: number; pending: number }> => {
    const res = await apiClient.get(`${base(orgId)}/recurring/${id}/stats`)
    return unwrap<{ total: number; completed: number; pending: number }>(res)
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
}
