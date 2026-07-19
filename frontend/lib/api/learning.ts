import apiClient from './client';
import type {
  LearningPath,
  LearningItem,
  LearningPathAssignment,
  MaterialViewData,
  OrgProgressSummary,
  PathEngagement,
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

export async function unarchivePath(orgId: string, pathId: string): Promise<LearningPath> {
  const res = await apiClient.post(`${orgBase(orgId)}/paths/${pathId}/unarchive`);
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

// ─── Material files (upload + preview) ─────────────────────────────────────────

/** Upload/replace the document backing a file item; returns the updated item. */
export async function uploadItemFile(
  orgId: string,
  pathId: string,
  itemId: string,
  file: File,
  allowDownload: boolean,
  onProgress?: (percent: number) => void,
): Promise<LearningItem> {
  const form = new FormData();
  form.append('file', file);
  form.append('allow_download', String(allowDownload));
  const res = await apiClient.post(
    `${orgBase(orgId)}/paths/${pathId}/items/${itemId}/file`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    },
  );
  return res.data.data;
}

/** Creator/admin inline preview URL for a material (no view tracking). */
export async function getAdminItemViewUrl(
  orgId: string,
  pathId: string,
  itemId: string,
): Promise<MaterialViewData> {
  const res = await apiClient.get(
    `${orgBase(orgId)}/paths/${pathId}/items/${itemId}/view-url`,
  );
  return res.data.data;
}

/** Creator/admin download of a material (for previewing the course) — opens a signed URL. */
export async function downloadAdminItem(
  orgId: string,
  pathId: string,
  itemId: string,
): Promise<void> {
  const res = await apiClient.get(
    `${orgBase(orgId)}/paths/${pathId}/items/${itemId}/download-url`,
  )
  const { url } = res.data.data as { url: string; file_name: string }
  if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener')
}

/** Raw preview bytes (same-origin, authenticated) for pdf.js rendering — creator/admin. */
export async function getAdminItemFile(
  orgId: string,
  pathId: string,
  itemId: string,
): Promise<ArrayBuffer> {
  const res = await apiClient.get(
    `${orgBase(orgId)}/paths/${pathId}/items/${itemId}/view-file`,
    { responseType: 'arraybuffer' },
  )
  return res.data as ArrayBuffer
}

// ─── Engagement analytics ──────────────────────────────────────────────────────

export async function getEngagement(
  orgId: string,
  pathId: string,
): Promise<PathEngagement> {
  const res = await apiClient.get(`${orgBase(orgId)}/paths/${pathId}/engagement`);
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

/** Undo an accidental completion of an assigned item. */
export async function uncompleteItem(
  orgId: string,
  assignmentId: string,
  itemId: string,
) {
  const res = await apiClient.post(
    `${orgBase(orgId)}/my/${assignmentId}/items/${itemId}/uncomplete`,
  )
  return res.data.data
}

/** Learner inline preview URL for an assigned material (records the view). */
export async function getMyItemViewUrl(
  orgId: string,
  assignmentId: string,
  itemId: string,
): Promise<MaterialViewData> {
  const res = await apiClient.get(
    `${orgBase(orgId)}/my/${assignmentId}/items/${itemId}/view-url`,
  );
  return res.data.data;
}

/** Raw preview bytes (same-origin, authenticated) for pdf.js rendering — learner. */
export async function getMyItemFile(
  orgId: string,
  assignmentId: string,
  itemId: string,
): Promise<ArrayBuffer> {
  const res = await apiClient.get(
    `${orgBase(orgId)}/my/${assignmentId}/items/${itemId}/view-file`,
    { responseType: 'arraybuffer' },
  )
  return res.data as ArrayBuffer
}

/** Learner download of a material — resolves a signed URL then triggers the download. */
export async function downloadMyItem(
  orgId: string,
  assignmentId: string,
  itemId: string,
): Promise<void> {
  const res = await apiClient.get(
    `${orgBase(orgId)}/my/${assignmentId}/items/${itemId}/download-url`,
  );
  const { url } = res.data.data as { url: string; file_name: string };
  if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
}
