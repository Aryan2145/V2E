import apiClient from './client';
import type {
  LearningPath,
  LearningPathAssignment,
  OrgProgressSummary,
} from '../types/learning';

function orgBase(orgId: string) {
  return `/api/v1/org/${orgId}/learning`;
}

// ─── Paths ───────────────────────────────────────────────────────────────────

export async function getPaths(orgId: string): Promise<LearningPath[]> {
  const res = await apiClient.get(`${orgBase(orgId)}/paths`);
  return res.data.data;
}

export async function getPath(orgId: string, pathId: string): Promise<LearningPath> {
  const res = await apiClient.get(`${orgBase(orgId)}/paths/${pathId}`);
  return res.data.data;
}

export async function createPath(
  orgId: string,
  data: Partial<LearningPath>,
): Promise<LearningPath> {
  const res = await apiClient.post(`${orgBase(orgId)}/paths`, data);
  return res.data.data;
}

export async function updatePath(
  orgId: string,
  pathId: string,
  data: Partial<LearningPath>,
): Promise<LearningPath> {
  const res = await apiClient.patch(`${orgBase(orgId)}/paths/${pathId}`, data);
  return res.data.data;
}

export async function publishPath(orgId: string, pathId: string): Promise<LearningPath> {
  const res = await apiClient.post(`${orgBase(orgId)}/paths/${pathId}/publish`);
  return res.data.data;
}

export async function archivePath(orgId: string, pathId: string): Promise<LearningPath> {
  const res = await apiClient.post(`${orgBase(orgId)}/paths/${pathId}/archive`);
  return res.data.data;
}

export async function deletePath(orgId: string, pathId: string): Promise<void> {
  await apiClient.delete(`${orgBase(orgId)}/paths/${pathId}`);
}

// ─── Items ───────────────────────────────────────────────────────────────────

export async function addItem(orgId: string, pathId: string, data: any) {
  const res = await apiClient.post(`${orgBase(orgId)}/paths/${pathId}/items`, data);
  return res.data.data;
}

export async function updateItem(
  orgId: string,
  pathId: string,
  itemId: string,
  data: any,
) {
  const res = await apiClient.patch(
    `${orgBase(orgId)}/paths/${pathId}/items/${itemId}`,
    data,
  );
  return res.data.data;
}

export async function deleteItem(orgId: string, pathId: string, itemId: string) {
  await apiClient.delete(`${orgBase(orgId)}/paths/${pathId}/items/${itemId}`);
}

export async function reorderItems(
  orgId: string,
  pathId: string,
  items: { id: string; order_index: number }[],
) {
  const res = await apiClient.patch(
    `${orgBase(orgId)}/paths/${pathId}/items/reorder`,
    { items },
  );
  return res.data.data;
}

// ─── Assignments ─────────────────────────────────────────────────────────────

export async function assignPath(
  orgId: string,
  pathId: string,
  employee_profile_ids: string[],
  due_date?: string,
) {
  const res = await apiClient.post(`${orgBase(orgId)}/paths/${pathId}/assign`, {
    employee_profile_ids,
    due_date,
  });
  return res.data.data;
}

export async function getAssignments(
  orgId: string,
  pathId: string,
): Promise<LearningPathAssignment[]> {
  const res = await apiClient.get(`${orgBase(orgId)}/paths/${pathId}/assignments`);
  return res.data.data;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function getOrgProgress(orgId: string): Promise<OrgProgressSummary> {
  const res = await apiClient.get(`${orgBase(orgId)}/progress`);
  return res.data.data;
}

// ─── Employee: My Learning ─────────────────────────────────────────────────

export async function getMyAssignments(
  orgId: string,
): Promise<LearningPathAssignment[]> {
  const res = await apiClient.get(`${orgBase(orgId)}/my`);
  return res.data.data;
}

export async function getMyAssignment(
  orgId: string,
  assignmentId: string,
): Promise<LearningPathAssignment> {
  const res = await apiClient.get(`${orgBase(orgId)}/my/${assignmentId}`);
  return res.data.data;
}

export async function completeItem(
  orgId: string,
  assignmentId: string,
  itemId: string,
  completion_type: 'manual' | 'auto_opened',
) {
  const res = await apiClient.post(
    `${orgBase(orgId)}/my/${assignmentId}/items/${itemId}/complete`,
    { completion_type },
  );
  return res.data.data;
}
