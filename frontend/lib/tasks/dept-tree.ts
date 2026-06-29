import type { Department } from '@/lib/types'
import { addTiming, emptyTiming, type TimingCounts } from '@/lib/types/tasks'

/** A department node with resolved children, for hierarchical drill + subtree roll-ups. */
export interface DeptNode {
  id: string
  name: string
  color?: string | null
  parent_id: string | null
  children: DeptNode[]
}

export interface DeptForest {
  roots: DeptNode[]
  byId: Map<string, DeptNode>
}

/** Assemble a department forest from the flat `parent_department_id` list. */
export function buildDeptForest(depts: Department[]): DeptForest {
  const byId = new Map<string, DeptNode>(
    depts.map((d) => [d.id, { id: d.id, name: d.name, color: (d as any).color ?? null, parent_id: d.parent_department_id ?? null, children: [] }]),
  )
  const roots: DeptNode[] = []
  for (const node of Array.from(byId.values())) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  }
  const sortRec = (arr: DeptNode[]) => {
    arr.sort((a, b) => a.name.localeCompare(b.name))
    arr.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return { roots, byId }
}

/** All department ids in a node's subtree (the node itself + every descendant). */
export function subtreeIds(node: DeptNode): string[] {
  return [node.id, ...node.children.flatMap(subtreeIds)]
}

/** Root → node path (inclusive), for breadcrumbs. */
export function pathTo(byId: Map<string, DeptNode>, id: string): DeptNode[] {
  const chain: DeptNode[] = []
  let cur = byId.get(id)
  while (cur) {
    chain.unshift(cur)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return chain
}

export interface DeptRollup {
  id: string
  name: string
  color?: string | null
  total: number
  timing: TimingCounts
  hasChildren: boolean
}

/**
 * Roll a node's whole subtree into one total + timing record, summing the per-department
 * counts from the dashboard's flat `by_department`. Departments absent from the map
 * contribute nothing (no tasks in the current scope/filter).
 */
export function rollupNode(node: DeptNode, byDept: Map<string, { total: number; timing: TimingCounts }>): DeptRollup {
  let total = 0
  let timing = emptyTiming()
  for (const id of subtreeIds(node)) {
    const v = byDept.get(id)
    if (v) { total += v.total; timing = addTiming(timing, v.timing) }
  }
  return { id: node.id, name: node.name, color: node.color, total, timing, hasChildren: node.children.length > 0 }
}
