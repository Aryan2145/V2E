import apiClient from './client'
import type {
  WorkflowTemplate,
  WorkflowStep,
  WorkflowTrigger,
  WorkflowAccess,
  WorkflowInstance,
  WorkflowMaster,
  WorkflowNotification,
} from '@/lib/types/workflows'

const base = (orgId: string) => `/api/v1/org/${orgId}/workflows`

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

export const workflowsApi = {
  // ── Masters ──────────────────────────────────────────────────────────────────

  getMaster: async (orgId: string): Promise<WorkflowMaster> => {
    const res = await apiClient.get(`${base(orgId)}/masters`)
    return unwrap<WorkflowMaster>(res)
  },

  updateMaster: async (orgId: string, dto: Partial<{ workflow_creation_roles: string[]; default_overdue_action: string }>): Promise<WorkflowMaster> => {
    const res = await apiClient.patch(`${base(orgId)}/masters`, dto)
    return unwrap<WorkflowMaster>(res)
  },

  // ── Templates ────────────────────────────────────────────────────────────────

  listWorkflows: async (orgId: string): Promise<WorkflowTemplate[]> => {
    const res = await apiClient.get(`${base(orgId)}`)
    return unwrap<WorkflowTemplate[]>(res)
  },

  getWorkflow: async (orgId: string, id: string): Promise<WorkflowTemplate> => {
    const res = await apiClient.get(`${base(orgId)}/${id}`)
    return unwrap<WorkflowTemplate>(res)
  },

  createWorkflow: async (orgId: string, dto: {
    name: string
    description?: string
    workflow_nature?: string
    recurring_type?: string
    show_workflow_on_task_card?: boolean
  }): Promise<WorkflowTemplate> => {
    const res = await apiClient.post(`${base(orgId)}`, dto)
    return unwrap<WorkflowTemplate>(res)
  },

  updateWorkflow: async (orgId: string, id: string, dto: Partial<WorkflowTemplate>): Promise<WorkflowTemplate> => {
    const res = await apiClient.patch(`${base(orgId)}/${id}`, dto)
    return unwrap<WorkflowTemplate>(res)
  },

  publishWorkflow: async (orgId: string, id: string): Promise<WorkflowTemplate> => {
    const res = await apiClient.post(`${base(orgId)}/${id}/publish`)
    return unwrap<WorkflowTemplate>(res)
  },

  archiveWorkflow: async (orgId: string, id: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/${id}`)
  },

  // ── Steps ────────────────────────────────────────────────────────────────────

  addStep: async (orgId: string, templateId: string, dto: Partial<WorkflowStep>): Promise<WorkflowStep> => {
    const res = await apiClient.post(`${base(orgId)}/${templateId}/steps`, dto)
    return unwrap<WorkflowStep>(res)
  },

  updateStep: async (orgId: string, templateId: string, stepId: string, dto: Partial<WorkflowStep>): Promise<WorkflowStep> => {
    const res = await apiClient.patch(`${base(orgId)}/${templateId}/steps/${stepId}`, dto)
    return unwrap<WorkflowStep>(res)
  },

  deleteStep: async (orgId: string, templateId: string, stepId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/${templateId}/steps/${stepId}`)
  },

  reorderSteps: async (orgId: string, templateId: string, items: { id: string; order_index: number }[]): Promise<WorkflowStep[]> => {
    const res = await apiClient.post(`${base(orgId)}/${templateId}/steps/reorder`, { items })
    return unwrap<WorkflowStep[]>(res)
  },

  swapSteps: async (orgId: string, templateId: string, stepId1: string, stepId2: string): Promise<WorkflowStep[]> => {
    const res = await apiClient.post(`${base(orgId)}/${templateId}/steps/swap`, { stepId1, stepId2 })
    return unwrap<WorkflowStep[]>(res)
  },

  // ── Triggers ─────────────────────────────────────────────────────────────────

  listTriggers: async (orgId: string, templateId: string): Promise<WorkflowTrigger[]> => {
    const res = await apiClient.get(`${base(orgId)}/${templateId}/triggers`)
    return unwrap<WorkflowTrigger[]>(res)
  },

  addTrigger: async (orgId: string, templateId: string, dto: { type: string; config: Record<string, unknown>; is_active?: boolean }): Promise<WorkflowTrigger> => {
    const res = await apiClient.post(`${base(orgId)}/${templateId}/triggers`, dto)
    return unwrap<WorkflowTrigger>(res)
  },

  updateTrigger: async (orgId: string, templateId: string, triggerId: string, dto: Partial<WorkflowTrigger>): Promise<WorkflowTrigger> => {
    const res = await apiClient.patch(`${base(orgId)}/${templateId}/triggers/${triggerId}`, dto)
    return unwrap<WorkflowTrigger>(res)
  },

  deleteTrigger: async (orgId: string, templateId: string, triggerId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/${templateId}/triggers/${triggerId}`)
  },

  // ── Access ───────────────────────────────────────────────────────────────────

  listAccess: async (orgId: string, templateId: string): Promise<WorkflowAccess[]> => {
    const res = await apiClient.get(`${base(orgId)}/${templateId}/access`)
    return unwrap<WorkflowAccess[]>(res)
  },

  grantAccess: async (orgId: string, templateId: string, dto: { user_id: string; access_type: string }): Promise<WorkflowAccess> => {
    const res = await apiClient.post(`${base(orgId)}/${templateId}/access`, dto)
    return unwrap<WorkflowAccess>(res)
  },

  revokeAccess: async (orgId: string, templateId: string, userId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/${templateId}/access/${userId}`)
  },

  // ── Instances ────────────────────────────────────────────────────────────────

  triggerInstance: async (orgId: string, templateId: string, name: string): Promise<{ id: string }> => {
    const res = await apiClient.post(`${base(orgId)}/${templateId}/instances/trigger`, { name })
    return unwrap<{ id: string }>(res)
  },

  listInstances: async (orgId: string, templateId: string): Promise<WorkflowInstance[]> => {
    const res = await apiClient.get(`${base(orgId)}/${templateId}/instances`)
    return unwrap<WorkflowInstance[]>(res)
  },

  getInstance: async (orgId: string, templateId: string, instanceId: string): Promise<WorkflowInstance> => {
    const res = await apiClient.get(`${base(orgId)}/${templateId}/instances/${instanceId}`)
    return unwrap<WorkflowInstance>(res)
  },

  getInstanceTasks: async (orgId: string, instanceId: string): Promise<import('@/lib/types/tasks').Task[]> => {
    const res = await apiClient.get(`${base(orgId)}/any/instances/${instanceId}/tasks`)
    return unwrap<import('@/lib/types/tasks').Task[]>(res)
  },

  cancelInstance: async (orgId: string, instanceId: string): Promise<WorkflowInstance> => {
    const res = await apiClient.post(`${base(orgId)}/any/instances/${instanceId}/cancel`)
    return unwrap<WorkflowInstance>(res)
  },

  // ── My workflows ─────────────────────────────────────────────────────────────

  getOwnedWorkflows: async (orgId: string): Promise<WorkflowTemplate[]> => {
    const res = await apiClient.get(`${base(orgId)}/my/owned`)
    return unwrap<WorkflowTemplate[]>(res)
  },

  getOwnedInstances: async (orgId: string): Promise<WorkflowInstance[]> => {
    const res = await apiClient.get(`${base(orgId)}/my/owned/instances`)
    return unwrap<WorkflowInstance[]>(res)
  },

  // ── Notifications ─────────────────────────────────────────────────────────────

  getNotifications: async (orgId: string): Promise<WorkflowNotification[]> => {
    const res = await apiClient.get(`${base(orgId)}/notifications`)
    return unwrap<WorkflowNotification[]>(res)
  },

  markNotificationRead: async (orgId: string, id: string): Promise<void> => {
    await apiClient.patch(`${base(orgId)}/notifications/${id}/read`)
  },
}
