import type { Department } from './types'

/**
 * Tidy top-down hierarchical layout for the department org chart.
 *
 * Departments form a strict tree via `parent_department_id`, so we can compute
 * a clean Reingold–Tilford-style layout without a graph-layout dependency:
 * leaves are spread left-to-right; a parent is centered over its children;
 * depth maps to the vertical axis.
 */

export interface XY {
  x: number
  y: number
}

// Spacing tuned to the DeptNode footprint (~180–200px wide, ~90px tall).
export const H_SPACING = 240 // horizontal distance between adjacent leaves
export const V_SPACING = 170 // vertical distance between levels

function buildChildren(departments: Department[]): {
  children: Map<string, string[]>
  roots: string[]
} {
  const byId = new Set(departments.map((d) => d.id))
  const children = new Map<string, string[]>()
  const roots: string[] = []
  for (const d of departments) {
    const pid = d.parent_department_id
    if (pid && byId.has(pid)) {
      const arr = children.get(pid) ?? []
      arr.push(d.id)
      children.set(pid, arr)
    } else {
      roots.push(d.id)
    }
  }
  return { children, roots }
}

/** Compute tidy {x,y} positions for every department, keyed by id. */
export function computeTreeLayout(departments: Department[]): Record<string, XY> {
  const { children, roots } = buildChildren(departments)
  const pos: Record<string, XY> = {}
  let nextLeafX = 0

  const layout = (id: string, depth: number): number => {
    const kids = children.get(id) ?? []
    const y = depth * V_SPACING
    let x: number
    if (kids.length === 0) {
      x = nextLeafX * H_SPACING
      nextLeafX += 1
    } else {
      const xs = kids.map((k) => layout(k, depth + 1))
      x = (xs[0] + xs[xs.length - 1]) / 2
    }
    pos[id] = { x, y }
    return x
  }

  for (const r of roots) layout(r, 0)
  return pos
}

export interface FlatDept {
  department: Department
  depth: number
  /** The parent department, or null for a top-level (root) department. */
  parent: Department | null
}

/**
 * Flatten the department tree into a depth-first **pre-order** list:
 * each parent is immediately followed by its full subtree, then the next
 * parent — so the list reads top-down like an indented org outline.
 * Siblings (and roots) are ordered alphabetically for a stable table.
 * Any orphaned cycle members are appended at the end so nothing is dropped.
 */
export function flattenDepartmentTree(departments: Department[]): FlatDept[] {
  const { children, roots } = buildChildren(departments)
  const byId = new Map(departments.map((d) => [d.id, d]))
  const byName = (a: string, b: string) =>
    byId.get(a)!.name.localeCompare(byId.get(b)!.name, undefined, { sensitivity: 'base' })

  const out: FlatDept[] = []
  const seen = new Set<string>()
  const walk = (id: string, depth: number, parent: Department | null) => {
    if (seen.has(id)) return
    seen.add(id)
    out.push({ department: byId.get(id)!, depth, parent })
    for (const child of (children.get(id) ?? []).slice().sort(byName)) {
      walk(child, depth + 1, byId.get(id)!)
    }
  }
  for (const r of roots.slice().sort(byName)) walk(r, 0, null)
  // Safety net: surface anything unreachable (e.g. a parent cycle).
  for (const d of departments) if (!seen.has(d.id)) out.push({ department: d, depth: 0, parent: null })
  return out
}

/**
 * A sensible position for a NEW department: directly below its parent, offset by
 * the number of existing siblings so it doesn't overlap them. Top-level depts go
 * on the root row. The user can press "Auto-arrange" afterwards to fully tidy.
 */
export function placeUnderParent(departments: Department[], parentId?: string): XY {
  if (parentId) {
    const parent = departments.find((d) => d.id === parentId)
    if (parent) {
      const siblings = departments.filter((d) => d.parent_department_id === parentId)
      return {
        x: parent.position_x + siblings.length * H_SPACING,
        y: parent.position_y + V_SPACING,
      }
    }
  }
  const rootCount = departments.filter((d) => !d.parent_department_id).length
  return { x: rootCount * H_SPACING, y: 0 }
}
