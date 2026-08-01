import apiClient from './client'

const base = (orgId: string) => `/api/v1/org/${orgId}/process-hierarchy`

function unwrap<T>(res: { data: { data: T } | T }): T {
  const d = res.data as { data?: T }
  return d.data !== undefined ? (d.data as T) : (res.data as T)
}

// ─── Types ───────────────────────────────────────────────────────────────────
export type ProcessNodeKind = 'container' | 'task' | 'decision' | 'subprocess' | 'start_event' | 'end_event' | 'note'
export type ProcessNodeStatus = 'draft' | 'in_review' | 'final'
export type ProcessConditionKind = 'none' | 'yes' | 'no'
export type ProcessArtifactType = 'form' | 'report' | 'document' | 'data' | 'other'
export type ProcessArtifactContentType = 'file' | 'link' | 'article'
export type ProcessArtifactDirection = 'input' | 'output'
export type ProcessAccessKind = 'department' | 'role' | 'user' | 'exclude_user'
export type ProcessAccessLevel = 'view' | 'edit'
export type ProcessSnapshotStatus = 'draft' | 'in_review' | 'final'
export type ProcessPool = 'customer' | 'company' | 'vendor'
export type ProcessLaneOrigin = 'manual' | 'auto'

export interface ProcessMapSummary {
  id: string
  name: string
  description: string | null
  parent_map_id: string | null
  is_pinned: boolean
  node_count: number
  is_owner: boolean
  can_edit: boolean
  created_at: string
  updated_at: string
}

export interface ProcessMapDetail {
  id: string
  name: string
  chart_type: string // renderer family of the root level (swimlane|org|mindmap|…)
  description: string | null
  created_by_user_id: string
  is_owner: boolean
  can_edit: boolean
  created_at: string
  updated_at: string
}

export interface ArtifactRef { id: string; name: string; content_type?: ProcessArtifactContentType }

export interface ProcessNode {
  id: string
  map_id: string
  parent_node_id: string | null
  kind: ProcessNodeKind
  name: string
  description: string | null
  status: ProcessNodeStatus
  responsible_role_id: string | null
  responsible_user_id: string | null
  chart_type?: string // for a container: renderer family of the level inside it
  pool?: ProcessPool | null // swimlane participant band (null = free-form, no swimlane)
  department_id?: string | null // the lane within the Company pool
  position_x: number
  position_y: number
  sort_order: number
  child_count?: number
  linked_map_id?: string | null // cross-map link
  linked_map_name?: string | null
  inputs?: ArtifactRef[] // light refs for edge chips (from the flow endpoint)
  outputs?: ArtifactRef[]
  checklist?: { id: string; text: string }[] // task checklist, for on-canvas expand
}

export interface ProcessConnection {
  id: string
  map_id: string
  parent_node_id: string | null
  source_node_id: string
  target_node_id: string
  label: string | null
  condition_kind: ProcessConditionKind
  source_side?: string | null // swimlane: which dot of the source the line exits (right|bottom|top|left)
}

export interface ProcessLane {
  id: string
  department_id: string
  department_name: string
  origin: ProcessLaneOrigin
  sort_order: number
}

export interface FlowLevel {
  map_id: string
  parent_node_id: string | null
  chart_type: string // renderer family for THIS level (swimlane|org|mindmap|…)
  breadcrumb: { id: string; name: string }[]
  can_edit: boolean
  nodes: ProcessNode[]
  connections: ProcessConnection[]
  lanes: ProcessLane[] // Company-pool department bands for this level (top→bottom)
}

export interface TreeNode {
  id: string
  parent_node_id: string | null
  kind: ProcessNodeKind
  name: string
  status: ProcessNodeStatus
  sort_order: number
  linked_map_id: string | null
  linked_map_name: string | null
}

export interface MapTree {
  map_id: string
  can_edit: boolean
  nodes: TreeNode[]
}

export interface ProcessArtifact {
  id: string
  map_id: string
  name: string
  description: string | null
  artifact_type: ProcessArtifactType
  content_type: ProcessArtifactContentType
  url: string | null
  content_body: string | null
  allow_download: boolean
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  storage_key: string | null
}

export interface NodeArtifactLink {
  id: string
  node_id: string
  artifact_id: string
  direction: ProcessArtifactDirection
  artifact: ProcessArtifact
}

export interface AccessRule {
  id: string
  node_id: string
  kind: ProcessAccessKind
  level: ProcessAccessLevel
  department_id: string | null
  include_sub_departments: boolean
  role_id: string | null
  user_id: string | null
  label?: string
}

export interface ChecklistItem {
  id: string
  node_id: string
  text: string
  sort_order: number
}

export interface NodeDetail extends Omit<ProcessNode, 'inputs' | 'outputs'> {
  can_edit: boolean
  can_approve: boolean
  responsible_user: { id: string; name: string } | null
  responsible_role: { id: string; title: string } | null
  linked_map: { id: string; name: string; owned: boolean } | null
  checklist: ChecklistItem[]
  inputs: NodeArtifactLink[]
  outputs: NodeArtifactLink[]
  access_rules: AccessRule[]
}

export interface ProcessTemplateSummary {
  id: string
  name: string
  description: string | null
  created_by_user_id: string
  created_at: string
}

// ─── Diff (as-is vs to-be) ─────────────────────────────────────────────────────
export type DiffChangeKind = 'added' | 'removed' | 'changed' | 'unchanged'
export interface FieldChange { field: string; from: unknown; to: unknown }
export interface NodeChange {
  id: string; name: string; kind: ProcessNodeKind; parent_node_id: string | null
  change: 'added' | 'removed' | 'changed'; fields: FieldChange[]
}
export interface EdgeChange {
  id: string; source_node_id: string; target_node_id: string; parent_node_id: string | null
  change: 'added' | 'removed' | 'changed'; fields: FieldChange[]
}
export interface ArtifactChange { id: string; name: string; change: 'added' | 'removed' | 'changed'; fields: FieldChange[] }
export interface MapDiff {
  base: string
  target: string
  nodes: NodeChange[]
  connections: EdgeChange[]
  artifacts: ArtifactChange[]
  node_status: Record<string, DiffChangeKind>
  summary: {
    nodes_added: number; nodes_removed: number; nodes_changed: number
    connections_added: number; connections_removed: number; connections_changed: number
    artifacts_added: number; artifacts_removed: number; artifacts_changed: number
    total_changes: number
  }
}

export interface SnapshotSummary {
  id: string
  label: string
  status: ProcessSnapshotStatus
  created_by_user_id: string
  created_at: string
}

// ─── API ─────────────────────────────────────────────────────────────────────
export const processHierarchyApi = {
  // Maps
  listMaps: async (orgId: string): Promise<ProcessMapSummary[]> =>
    unwrap(await apiClient.get(`${base(orgId)}/maps`)),
  createMap: async (orgId: string, dto: { name: string; description?: string; parent_map_id?: string | null }): Promise<ProcessMapDetail> =>
    unwrap(await apiClient.post(`${base(orgId)}/maps`, dto)),
  getMap: async (orgId: string, mapId: string): Promise<ProcessMapDetail> =>
    unwrap(await apiClient.get(`${base(orgId)}/maps/${mapId}`)),
  updateMap: async (orgId: string, mapId: string, dto: { name?: string; description?: string; parent_map_id?: string | null; is_pinned?: boolean }): Promise<ProcessMapDetail> =>
    unwrap(await apiClient.patch(`${base(orgId)}/maps/${mapId}`, dto)),
  deleteMap: async (orgId: string, mapId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/maps/${mapId}`)
  },

  // Flow / nodes
  getFlow: async (orgId: string, mapId: string, parentNodeId?: string | null): Promise<FlowLevel> => {
    const qs = parentNodeId ? `?parentNodeId=${parentNodeId}` : ''
    return unwrap(await apiClient.get(`${base(orgId)}/maps/${mapId}/flow${qs}`))
  },
  getTree: async (orgId: string, mapId: string): Promise<MapTree> =>
    unwrap(await apiClient.get(`${base(orgId)}/maps/${mapId}/tree`)),
  createNode: async (
    orgId: string,
    mapId: string,
    dto: { parent_node_id?: string | null; kind: ProcessNodeKind; name: string; description?: string; pool?: ProcessPool; department_id?: string; position_x?: number; position_y?: number; create_linked_map?: boolean; linked_map_id?: string },
  ): Promise<ProcessNode> => unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/nodes`, dto)),
  // Paste copied nodes (with their sub-trees) into this map/level.
  pasteNodes: async (
    orgId: string,
    mapId: string,
    dto: { source_map_id: string; node_ids: string[]; parent_node_id?: string | null; position_x?: number; position_y?: number },
  ): Promise<{ pasted_node_ids: string[] }> => unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/nodes/paste`, dto)),
  getNode: async (orgId: string, mapId: string, nodeId: string): Promise<NodeDetail> =>
    unwrap(await apiClient.get(`${base(orgId)}/maps/${mapId}/nodes/${nodeId}`)),
  updateNode: async (
    orgId: string,
    mapId: string,
    nodeId: string,
    dto: Partial<{
      kind: ProcessNodeKind
      name: string
      description: string
      status: ProcessNodeStatus
      responsible_role_id: string | null
      responsible_user_id: string | null
      pool: ProcessPool | null
      department_id: string | null
      position_x: number
      position_y: number
      linked_map_id: string | null
      parent_node_id: string | null
      checklist: { id?: string; text: string }[]
    }>,
  ): Promise<NodeDetail> => unwrap(await apiClient.patch(`${base(orgId)}/maps/${mapId}/nodes/${nodeId}`, dto)),
  bulkPosition: async (
    orgId: string,
    mapId: string,
    positions: { id: string; position_x: number; position_y: number }[],
  ): Promise<void> => {
    await apiClient.post(`${base(orgId)}/maps/${mapId}/node-positions`, { positions })
  },
  detachNode: async (orgId: string, mapId: string, nodeId: string): Promise<NodeDetail> =>
    unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/nodes/${nodeId}/detach`, {})),
  // Turn a container into a standalone map that can be referenced as a line item anywhere.
  makeNodeReusable: async (orgId: string, mapId: string, nodeId: string): Promise<NodeDetail> =>
    unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/nodes/${nodeId}/make-reusable`, {})),
  deleteNode: async (orgId: string, mapId: string, nodeId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/maps/${mapId}/nodes/${nodeId}`)
  },

  // Status workflow
  requestReview: async (orgId: string, mapId: string, nodeId: string, cascade: boolean): Promise<void> => {
    await apiClient.post(`${base(orgId)}/maps/${mapId}/nodes/${nodeId}/request-review`, { cascade })
  },
  decideStatus: async (orgId: string, mapId: string, nodeId: string, status: ProcessNodeStatus, cascade: boolean): Promise<void> => {
    await apiClient.post(`${base(orgId)}/maps/${mapId}/nodes/${nodeId}/decide-status`, { status, cascade })
  },

  // Connections
  createConnection: async (
    orgId: string,
    mapId: string,
    dto: { parent_node_id?: string | null; source_node_id: string; target_node_id: string; label?: string; condition_kind?: ProcessConditionKind; source_side?: string },
  ): Promise<ProcessConnection> => unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/connections`, dto)),
  updateConnection: async (
    orgId: string,
    mapId: string,
    connId: string,
    dto: { label?: string; condition_kind?: ProcessConditionKind },
  ): Promise<ProcessConnection> => unwrap(await apiClient.patch(`${base(orgId)}/maps/${mapId}/connections/${connId}`, dto)),
  deleteConnection: async (orgId: string, mapId: string, connId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/maps/${mapId}/connections/${connId}`)
  },

  // Swimlanes (Company-pool department bands). Create makes an empty, persistent lane;
  // delete needs move_to_department_id when the lane still has steps.
  createLane: async (
    orgId: string,
    mapId: string,
    dto: { department_id: string; parent_node_id?: string | null },
  ): Promise<ProcessLane> => unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/lanes`, dto)),
  deleteLane: async (orgId: string, mapId: string, laneId: string, moveToDepartmentId?: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/maps/${mapId}/lanes/${laneId}`, {
      params: moveToDepartmentId ? { move_to_department_id: moveToDepartmentId } : undefined,
    })
  },

  // Artifacts
  listArtifacts: async (orgId: string, mapId: string): Promise<ProcessArtifact[]> =>
    unwrap(await apiClient.get(`${base(orgId)}/maps/${mapId}/artifacts`)),
  createArtifact: async (
    orgId: string,
    mapId: string,
    dto: { name: string; description?: string; artifact_type?: ProcessArtifactType },
  ): Promise<ProcessArtifact> => unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/artifacts`, dto)),
  uploadArtifact: async (orgId: string, mapId: string, form: FormData): Promise<ProcessArtifact> =>
    unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/artifacts/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } })),
  createMaterial: async (
    orgId: string,
    mapId: string,
    dto: { name: string; url?: string; content_body?: string },
  ): Promise<ProcessArtifact> => unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/materials`, dto)),
  updateArtifact: async (
    orgId: string,
    mapId: string,
    artifactId: string,
    dto: { name?: string; description?: string; artifact_type?: ProcessArtifactType; url?: string; content_body?: string; allow_download?: boolean },
  ): Promise<ProcessArtifact> => unwrap(await apiClient.patch(`${base(orgId)}/maps/${mapId}/artifacts/${artifactId}`, dto)),
  deleteArtifact: async (orgId: string, mapId: string, artifactId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/maps/${mapId}/artifacts/${artifactId}`)
  },
  // Full detail for one document — used to preview it straight from the canvas.
  getArtifact: async (orgId: string, mapId: string, artifactId: string): Promise<ProcessArtifact> =>
    unwrap(await apiClient.get(`${base(orgId)}/maps/${mapId}/artifacts/${artifactId}`)),
  viewArtifact: async (orgId: string, mapId: string, artifactId: string): Promise<{ url: string; file_name: string | null; mime_type: string | null; allow_download: boolean }> =>
    unwrap(await apiClient.get(`${base(orgId)}/maps/${mapId}/artifacts/${artifactId}/view`)),
  // Same-origin raw bytes (for pdf.js / OfficeViewer, avoiding R2 CORS).
  viewArtifactBytes: async (orgId: string, mapId: string, artifactId: string): Promise<ArrayBuffer> =>
    (await apiClient.get(`${base(orgId)}/maps/${mapId}/artifacts/${artifactId}/view-file`, { responseType: 'arraybuffer' })).data as ArrayBuffer,
  downloadArtifact: async (orgId: string, mapId: string, artifactId: string): Promise<{ url: string }> =>
    unwrap(await apiClient.get(`${base(orgId)}/maps/${mapId}/artifacts/${artifactId}/download`)),
  linkArtifact: async (
    orgId: string,
    mapId: string,
    nodeId: string,
    dto: { artifact_id: string; direction: ProcessArtifactDirection },
  ): Promise<NodeArtifactLink> => unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/nodes/${nodeId}/artifacts`, dto)),
  unlinkArtifact: async (orgId: string, mapId: string, nodeId: string, linkId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/maps/${mapId}/nodes/${nodeId}/artifacts/${linkId}`)
  },

  // Access / sharing
  listAccess: async (orgId: string, mapId: string, nodeId: string): Promise<AccessRule[]> =>
    unwrap(await apiClient.get(`${base(orgId)}/maps/${mapId}/nodes/${nodeId}/access`)),
  addAccess: async (
    orgId: string,
    mapId: string,
    nodeId: string,
    dto: { kind: ProcessAccessKind; level?: ProcessAccessLevel; department_id?: string; include_sub_departments?: boolean; role_id?: string; user_id?: string },
  ): Promise<AccessRule> => unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/nodes/${nodeId}/access`, dto)),
  removeAccess: async (orgId: string, mapId: string, nodeId: string, ruleId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/maps/${mapId}/nodes/${nodeId}/access/${ruleId}`)
  },

  // Snapshots
  listSnapshots: async (orgId: string, mapId: string): Promise<SnapshotSummary[]> =>
    unwrap(await apiClient.get(`${base(orgId)}/maps/${mapId}/snapshots`)),
  createSnapshot: async (orgId: string, mapId: string, dto: { label: string; status?: ProcessSnapshotStatus }): Promise<SnapshotSummary> =>
    unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/snapshots`, dto)),
  restoreSnapshot: async (orgId: string, mapId: string, snapshotId: string): Promise<void> => {
    await apiClient.post(`${base(orgId)}/maps/${mapId}/snapshots/${snapshotId}/restore`, {})
  },

  // Undo/redo session history — capture the whole map state, and rebuild from a captured one
  // (no version row created). Powers the editor's Ctrl+Z / Ctrl+Y.
  exportState: async (orgId: string, mapId: string): Promise<unknown> =>
    unwrap(await apiClient.get(`${base(orgId)}/maps/${mapId}/state`)),
  restoreState: async (orgId: string, mapId: string, tree: unknown): Promise<void> => {
    await apiClient.post(`${base(orgId)}/maps/${mapId}/restore-state`, { tree_json: tree })
  },

  // Diff
  diff: async (orgId: string, mapId: string, baseRef: string, targetRef: string): Promise<MapDiff> =>
    unwrap(await apiClient.get(`${base(orgId)}/maps/${mapId}/diff?base=${baseRef}&target=${targetRef}`)),

  // Templates
  listTemplates: async (orgId: string): Promise<ProcessTemplateSummary[]> =>
    unwrap(await apiClient.get(`${base(orgId)}/templates`)),
  saveAsTemplate: async (orgId: string, mapId: string, dto: { name: string; description?: string }): Promise<ProcessTemplateSummary> =>
    unwrap(await apiClient.post(`${base(orgId)}/maps/${mapId}/save-as-template`, dto)),
  instantiateTemplate: async (orgId: string, templateId: string, name: string): Promise<ProcessMapDetail> =>
    unwrap(await apiClient.post(`${base(orgId)}/templates/${templateId}/instantiate`, { name })),
  deleteTemplate: async (orgId: string, templateId: string): Promise<void> => {
    await apiClient.delete(`${base(orgId)}/templates/${templateId}`)
  },
}
