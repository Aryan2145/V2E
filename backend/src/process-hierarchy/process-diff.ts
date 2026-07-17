/**
 * Pure map-diff used by the "as-is vs to-be" comparison. Given two serialized map
 * trees (the same shape ProcessSnapshot.tree_json stores, or a freshly serialized
 * live map), produce a structured, field-level delta plus a per-node status map the
 * canvas tints with. No DB access — deterministic and unit-testable.
 */

export type ChangeKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface NodeChange {
  id: string;
  name: string;
  kind: string;
  parent_node_id: string | null;
  change: 'added' | 'removed' | 'changed';
  fields: FieldChange[];
}

export interface EdgeChange {
  id: string;
  source_node_id: string;
  target_node_id: string;
  parent_node_id: string | null;
  change: 'added' | 'removed' | 'changed';
  fields: FieldChange[];
}

export interface ArtifactChange {
  id: string;
  name: string;
  change: 'added' | 'removed' | 'changed';
  fields: FieldChange[];
}

export interface MapDiff {
  nodes: NodeChange[];
  connections: EdgeChange[];
  artifacts: ArtifactChange[];
  node_status: Record<string, ChangeKind>;
  summary: {
    nodes_added: number;
    nodes_removed: number;
    nodes_changed: number;
    connections_added: number;
    connections_removed: number;
    connections_changed: number;
    artifacts_added: number;
    artifacts_removed: number;
    artifacts_changed: number;
    total_changes: number;
  };
}

interface Tree {
  nodes?: any[];
  connections?: any[];
  artifacts?: any[];
  links?: any[];
  checklist?: any[];
}

const NODE_FIELDS = [
  'name',
  'kind',
  'status',
  'description',
  'responsible_user_id',
  'responsible_role_id',
  'parent_node_id',
] as const;

const byId = <T extends { id: string }>(rows: T[] | undefined): Map<string, T> =>
  new Map((rows ?? []).map((r) => [r.id, r]));

/** nodeId → sorted checklist texts (order-independent comparison). */
function checklistByNode(tree: Tree): Map<string, string> {
  const m = new Map<string, string[]>();
  for (const c of tree.checklist ?? []) {
    (m.get(c.node_id) ?? m.set(c.node_id, []).get(c.node_id)!).push(String(c.text ?? ''));
  }
  const out = new Map<string, string>();
  for (const [k, v] of m) out.set(k, v.slice().sort().join('|'));
  return out;
}

/** nodeId → sorted "direction:artifact_id" signature. */
function linksByNode(tree: Tree): Map<string, string> {
  const m = new Map<string, string[]>();
  for (const l of tree.links ?? []) {
    (m.get(l.node_id) ?? m.set(l.node_id, []).get(l.node_id)!).push(`${l.direction}:${l.artifact_id}`);
  }
  const out = new Map<string, string>();
  for (const [k, v] of m) out.set(k, v.slice().sort().join('|'));
  return out;
}

export function computeMapDiff(base: Tree, target: Tree): MapDiff {
  const nodeChanges: NodeChange[] = [];
  const nodeStatus: Record<string, ChangeKind> = {};

  const baseNodes = byId(base.nodes);
  const targetNodes = byId(target.nodes);
  const baseChecklist = checklistByNode(base);
  const targetChecklist = checklistByNode(target);
  const baseLinks = linksByNode(base);
  const targetLinks = linksByNode(target);

  const allNodeIds = new Set<string>([...baseNodes.keys(), ...targetNodes.keys()]);
  for (const id of allNodeIds) {
    const b = baseNodes.get(id);
    const t = targetNodes.get(id);
    if (b && !t) {
      nodeStatus[id] = 'removed';
      nodeChanges.push({ id, name: b.name, kind: b.kind, parent_node_id: b.parent_node_id ?? null, change: 'removed', fields: [] });
    } else if (!b && t) {
      nodeStatus[id] = 'added';
      nodeChanges.push({ id, name: t.name, kind: t.kind, parent_node_id: t.parent_node_id ?? null, change: 'added', fields: [] });
    } else if (b && t) {
      const fields: FieldChange[] = [];
      for (const f of NODE_FIELDS) {
        if ((b[f] ?? null) !== (t[f] ?? null)) fields.push({ field: f, from: b[f] ?? null, to: t[f] ?? null });
      }
      if ((baseChecklist.get(id) ?? '') !== (targetChecklist.get(id) ?? '')) {
        fields.push({ field: 'checklist', from: (base.checklist ?? []).filter((c) => c.node_id === id).length, to: (target.checklist ?? []).filter((c) => c.node_id === id).length });
      }
      if ((baseLinks.get(id) ?? '') !== (targetLinks.get(id) ?? '')) {
        fields.push({ field: 'documents', from: (base.links ?? []).filter((l) => l.node_id === id).length, to: (target.links ?? []).filter((l) => l.node_id === id).length });
      }
      if (fields.length) {
        nodeStatus[id] = 'changed';
        nodeChanges.push({ id, name: t.name, kind: t.kind, parent_node_id: t.parent_node_id ?? null, change: 'changed', fields });
      } else {
        nodeStatus[id] = 'unchanged';
      }
    }
  }

  // Connections
  const edgeChanges: EdgeChange[] = [];
  const baseEdges = byId(base.connections);
  const targetEdges = byId(target.connections);
  for (const id of new Set<string>([...baseEdges.keys(), ...targetEdges.keys()])) {
    const b = baseEdges.get(id);
    const t = targetEdges.get(id);
    const ref = t ?? b;
    const base_common = { id, source_node_id: ref.source_node_id, target_node_id: ref.target_node_id, parent_node_id: ref.parent_node_id ?? null };
    if (b && !t) edgeChanges.push({ ...base_common, change: 'removed', fields: [] });
    else if (!b && t) edgeChanges.push({ ...base_common, change: 'added', fields: [] });
    else if (b && t) {
      const fields: FieldChange[] = [];
      for (const f of ['label', 'condition_kind', 'source_node_id', 'target_node_id']) {
        if ((b[f] ?? null) !== (t[f] ?? null)) fields.push({ field: f, from: b[f] ?? null, to: t[f] ?? null });
      }
      if (fields.length) edgeChanges.push({ ...base_common, change: 'changed', fields });
    }
  }

  // Artifacts (library)
  const artifactChanges: ArtifactChange[] = [];
  const baseArt = byId(base.artifacts);
  const targetArt = byId(target.artifacts);
  for (const id of new Set<string>([...baseArt.keys(), ...targetArt.keys()])) {
    const b = baseArt.get(id);
    const t = targetArt.get(id);
    if (b && !t) artifactChanges.push({ id, name: b.name, change: 'removed', fields: [] });
    else if (!b && t) artifactChanges.push({ id, name: t.name, change: 'added', fields: [] });
    else if (b && t) {
      const fields: FieldChange[] = [];
      for (const f of ['name', 'description', 'artifact_type', 'file_name']) {
        if ((b[f] ?? null) !== (t[f] ?? null)) fields.push({ field: f, from: b[f] ?? null, to: t[f] ?? null });
      }
      if (fields.length) artifactChanges.push({ id, name: t.name, change: 'changed', fields });
    }
  }

  const count = (arr: { change: string }[], k: string) => arr.filter((c) => c.change === k).length;
  const summary = {
    nodes_added: count(nodeChanges, 'added'),
    nodes_removed: count(nodeChanges, 'removed'),
    nodes_changed: count(nodeChanges, 'changed'),
    connections_added: count(edgeChanges, 'added'),
    connections_removed: count(edgeChanges, 'removed'),
    connections_changed: count(edgeChanges, 'changed'),
    artifacts_added: count(artifactChanges, 'added'),
    artifacts_removed: count(artifactChanges, 'removed'),
    artifacts_changed: count(artifactChanges, 'changed'),
    total_changes: nodeChanges.length + edgeChanges.length + artifactChanges.length,
  };

  return { nodes: nodeChanges, connections: edgeChanges, artifacts: artifactChanges, node_status: nodeStatus, summary };
}
