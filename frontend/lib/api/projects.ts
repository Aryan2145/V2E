import apiClient from './client'
import type {
  Project, ProjectMasterConfig, ProjectMember, ProjectMilestone, ProjectTask,
  ProjectTaskDependency, ProjectComment, ProjectDocument, ProjectActivityLog,
  ProjectTemplate, ProjectProgress, DependencyWarning,
} from '@/lib/types/projects'

function unwrap<T>(res: { data: { data?: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

const base = (orgId: string) => `/api/v1/org/${orgId}/projects`

export const projectsApi = {
  // Config
  getConfig: async (orgId: string): Promise<ProjectMasterConfig> => {
    const res = await apiClient.get(`${base(orgId)}/config`)
    return unwrap<ProjectMasterConfig>(res)
  },

  // Projects
  list: async (orgId: string): Promise<Project[]> => {
    const res = await apiClient.get(base(orgId))
    return unwrap<Project[]>(res)
  },
  listMy: async (orgId: string): Promise<Project[]> => {
    const res = await apiClient.get(`${base(orgId)}/my`)
    return unwrap<Project[]>(res)
  },
  listManaging: async (orgId: string): Promise<Project[]> => {
    const res = await apiClient.get(`${base(orgId)}/managing`)
    return unwrap<Project[]>(res)
  },
  get: async (orgId: string, projectId: string): Promise<Project> => {
    const res = await apiClient.get(`${base(orgId)}/${projectId}`)
    return unwrap<Project>(res)
  },
  create: async (orgId: string, dto: {
    name: string; description?: string; project_manager_user_id: string;
    start_date?: string; end_date?: string; planned_budget?: number;
    currency?: string; template_id?: string;
    /** Optional — the goals this project exists to move. */
    goal_ids?: string[];
  }): Promise<Project> => {
    const res = await apiClient.post(base(orgId), dto)
    return unwrap<Project>(res)
  },
  update: async (orgId: string, projectId: string, dto: Partial<{
    name: string; description: string; project_manager_user_id: string;
    start_date: string; end_date: string;
    /** The FULL set of goals this project serves — sending it replaces the links. */
    goal_ids: string[];
  }>): Promise<Project> => {
    const res = await apiClient.patch(`${base(orgId)}/${projectId}`, dto)
    return unwrap<Project>(res)
  },
  updateStatus: async (orgId: string, projectId: string, dto: { status: string; status_reason?: string }): Promise<Project> => {
    const res = await apiClient.patch(`${base(orgId)}/${projectId}/status`, dto)
    return unwrap<Project>(res)
  },
  updateBudget: async (orgId: string, projectId: string, dto: { planned_budget?: number; actual_spent?: number; currency?: string }): Promise<Project> => {
    const res = await apiClient.patch(`${base(orgId)}/${projectId}/budget`, dto)
    return unwrap<Project>(res)
  },
  delete: async (orgId: string, projectId: string, reason: string): Promise<{ message: string }> => {
    const res = await apiClient.delete(`${base(orgId)}/${projectId}`, { params: { reason } })
    return unwrap<{ message: string }>(res)
  },

  // Members
  listMembers: async (orgId: string, projectId: string): Promise<ProjectMember[]> => {
    const res = await apiClient.get(`${base(orgId)}/${projectId}/members`)
    return unwrap<ProjectMember[]>(res)
  },
  addMember: async (orgId: string, projectId: string, dto: { user_id: string; role?: string; task_visibility?: string }): Promise<ProjectMember> => {
    const res = await apiClient.post(`${base(orgId)}/${projectId}/members`, dto)
    return unwrap<ProjectMember>(res)
  },
  updateMember: async (orgId: string, projectId: string, userId: string, dto: { role?: string; task_visibility?: string }): Promise<ProjectMember> => {
    const res = await apiClient.patch(`${base(orgId)}/${projectId}/members/${userId}`, dto)
    return unwrap<ProjectMember>(res)
  },
  removeMember: async (orgId: string, projectId: string, userId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete(`${base(orgId)}/${projectId}/members/${userId}`)
    return unwrap<{ message: string }>(res)
  },

  // Milestones
  listMilestones: async (orgId: string, projectId: string): Promise<ProjectMilestone[]> => {
    const res = await apiClient.get(`${base(orgId)}/${projectId}/milestones`)
    return unwrap<ProjectMilestone[]>(res)
  },
  createMilestone: async (orgId: string, projectId: string, dto: { name: string; description?: string; due_date?: string; order_index?: number }): Promise<ProjectMilestone> => {
    const res = await apiClient.post(`${base(orgId)}/${projectId}/milestones`, dto)
    return unwrap<ProjectMilestone>(res)
  },
  updateMilestone: async (orgId: string, projectId: string, milestoneId: string, dto: Partial<{ name: string; description: string; due_date: string; order_index: number }>): Promise<ProjectMilestone> => {
    const res = await apiClient.patch(`${base(orgId)}/${projectId}/milestones/${milestoneId}`, dto)
    return unwrap<ProjectMilestone>(res)
  },
  deleteMilestone: async (orgId: string, projectId: string, milestoneId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete(`${base(orgId)}/${projectId}/milestones/${milestoneId}`)
    return unwrap<{ message: string }>(res)
  },

  // Tasks
  listTasks: async (orgId: string, projectId: string, milestoneId?: string): Promise<ProjectTask[]> => {
    const res = await apiClient.get(`${base(orgId)}/${projectId}/tasks`, { params: milestoneId ? { milestone_id: milestoneId } : undefined })
    return unwrap<ProjectTask[]>(res)
  },
  linkTask: async (orgId: string, projectId: string, dto: { task_id: string; milestone_id?: string }): Promise<ProjectTask> => {
    const res = await apiClient.post(`${base(orgId)}/${projectId}/tasks/link`, dto)
    return unwrap<ProjectTask>(res)
  },
  fulfillPendingTask: async (orgId: string, projectId: string, projectTaskId: string, taskId: string): Promise<ProjectTask> => {
    const res = await apiClient.post(`${base(orgId)}/${projectId}/tasks/${projectTaskId}/fulfill`, { task_id: taskId })
    return unwrap<ProjectTask>(res)
  },
  unlinkTask: async (orgId: string, projectId: string, projectTaskId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete(`${base(orgId)}/${projectId}/tasks/${projectTaskId}`)
    return unwrap<{ message: string }>(res)
  },
  getDependencyWarnings: async (orgId: string, projectId: string, taskId: string): Promise<DependencyWarning[]> => {
    const res = await apiClient.get(`${base(orgId)}/${projectId}/tasks/${taskId}/dependencies`)
    return unwrap<DependencyWarning[]>(res)
  },

  // Dependencies
  listDependencies: async (orgId: string, projectId: string): Promise<ProjectTaskDependency[]> => {
    const res = await apiClient.get(`${base(orgId)}/${projectId}/dependencies`)
    return unwrap<ProjectTaskDependency[]>(res)
  },
  addDependency: async (orgId: string, projectId: string, dto: { task_id: string; depends_on_task_id: string }): Promise<ProjectTaskDependency> => {
    const res = await apiClient.post(`${base(orgId)}/${projectId}/dependencies`, dto)
    return unwrap<ProjectTaskDependency>(res)
  },
  removeDependency: async (orgId: string, projectId: string, depId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete(`${base(orgId)}/${projectId}/dependencies/${depId}`)
    return unwrap<{ message: string }>(res)
  },

  // Comments
  listComments: async (orgId: string, projectId: string): Promise<ProjectComment[]> => {
    const res = await apiClient.get(`${base(orgId)}/${projectId}/comments`)
    return unwrap<ProjectComment[]>(res)
  },
  addComment: async (orgId: string, projectId: string, dto: { body: string; attachment_urls?: { name: string; url: string }[]; reply_to_comment_id?: string }): Promise<ProjectComment> => {
    const res = await apiClient.post(`${base(orgId)}/${projectId}/comments`, dto)
    return unwrap<ProjectComment>(res)
  },
  deleteComment: async (orgId: string, projectId: string, commentId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete(`${base(orgId)}/${projectId}/comments/${commentId}`)
    return unwrap<{ message: string }>(res)
  },

  // Documents
  listDocuments: async (orgId: string, projectId: string): Promise<ProjectDocument[]> => {
    const res = await apiClient.get(`${base(orgId)}/${projectId}/documents`)
    return unwrap<ProjectDocument[]>(res)
  },
  addDocument: async (orgId: string, projectId: string, dto: { name: string; url: string; type?: string }): Promise<ProjectDocument> => {
    const res = await apiClient.post(`${base(orgId)}/${projectId}/documents`, dto)
    return unwrap<ProjectDocument>(res)
  },
  deleteDocument: async (orgId: string, projectId: string, docId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete(`${base(orgId)}/${projectId}/documents/${docId}`)
    return unwrap<{ message: string }>(res)
  },

  // Activity & Progress
  getActivity: async (orgId: string, projectId: string): Promise<ProjectActivityLog[]> => {
    const res = await apiClient.get(`${base(orgId)}/${projectId}/activity`)
    return unwrap<ProjectActivityLog[]>(res)
  },
  getProgress: async (orgId: string, projectId: string): Promise<ProjectProgress> => {
    const res = await apiClient.get(`${base(orgId)}/${projectId}/progress`)
    return unwrap<ProjectProgress>(res)
  },
  forceRecalculate: async (orgId: string, projectId: string): Promise<ProjectProgress> => {
    const res = await apiClient.post(`${base(orgId)}/${projectId}/progress/recalculate`, {})
    return unwrap<ProjectProgress>(res)
  },

  // Templates
  listTemplates: async (orgId: string): Promise<ProjectTemplate[]> => {
    const res = await apiClient.get(`${base(orgId)}/templates`)
    return unwrap<ProjectTemplate[]>(res)
  },
  createTemplate: async (orgId: string, dto: { name: string; description?: string; milestones?: unknown[]; tasks?: unknown[] }): Promise<ProjectTemplate> => {
    const res = await apiClient.post(`${base(orgId)}/templates`, dto)
    return unwrap<ProjectTemplate>(res)
  },
  getTemplate: async (orgId: string, templateId: string): Promise<ProjectTemplate> => {
    const res = await apiClient.get(`${base(orgId)}/templates/${templateId}`)
    return unwrap<ProjectTemplate>(res)
  },
  updateTemplate: async (orgId: string, templateId: string, dto: Partial<{ name: string; description: string }>): Promise<ProjectTemplate> => {
    const res = await apiClient.patch(`${base(orgId)}/templates/${templateId}`, dto)
    return unwrap<ProjectTemplate>(res)
  },
  deleteTemplate: async (orgId: string, templateId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete(`${base(orgId)}/templates/${templateId}`)
    return unwrap<{ message: string }>(res)
  },
  addTemplateMilestone: async (orgId: string, templateId: string, dto: { name: string; description?: string; order_index?: number }): Promise<unknown> => {
    const res = await apiClient.post(`${base(orgId)}/templates/${templateId}/milestones`, dto)
    return unwrap<unknown>(res)
  },
  addTemplateTask: async (orgId: string, templateId: string, dto: { title: string; milestone_id?: string; description?: string; estimated_days?: number }): Promise<unknown> => {
    const res = await apiClient.post(`${base(orgId)}/templates/${templateId}/tasks`, dto)
    return unwrap<unknown>(res)
  },
}
