import type { Department } from './types'

/**
 * Helpers for rendering departments as a hierarchy in the Roles UI.
 *
 * Departments form a strict tree via `parent_department_id` (see
 * `org-chart-layout.ts`). The org chart needs {x,y} positions; the Roles page
 * needs an indented list and an ancestor breadcrumb, so those concerns live
 * here. Children are ordered by name for a stable, predictable layout — the
 * same ordering `computeNodeColors` uses to assign branch hues.
 */

export interface DeptForest {
  /** Top-level departments (no parent, or a parent outside this org's set). */
  roots: Department[]
  /** Children of a department id, sorted by name. */
  childrenOf: Map<string, Department[]>
}

export function buildDeptForest(departments: Department[]): DeptForest {
  const byId = new Set(departments.map((d) => d.id))
  const childrenOf = new Map<string, Department[]>()
  const roots: Department[] = []

  for (const d of departments) {
    const pid = d.parent_department_id
    if (pid && byId.has(pid)) {
      const arr = childrenOf.get(pid)
      if (arr) arr.push(d)
      else childrenOf.set(pid, [d])
    } else {
      roots.push(d)
    }
  }

  const byName = (a: Department, b: Department) => a.name.localeCompare(b.name)
  roots.sort(byName)
  childrenOf.forEach((arr) => arr.sort(byName))

  return { roots, childrenOf }
}

export interface FlatDept {
  dept: Department
  depth: number
}

/** Pre-order DFS flatten, so the tree renders as an indented list. */
export function flattenTree(departments: Department[]): FlatDept[] {
  const { roots, childrenOf } = buildDeptForest(departments)
  const out: FlatDept[] = []
  const walk = (dept: Department, depth: number) => {
    out.push({ dept, depth })
    for (const child of childrenOf.get(dept.id) ?? []) walk(child, depth + 1)
  }
  for (const r of roots) walk(r, 0)
  return out
}

/**
 * Descendants of a department in pre-order, each with its depth RELATIVE to the
 * given department (direct children = 0). Self is excluded. Used to show, and to
 * cascade over, the sub-departments a department sweeps in.
 */
export function descendantsOf(departments: Department[], deptId: string): FlatDept[] {
  const { childrenOf } = buildDeptForest(departments)
  const out: FlatDept[] = []
  const walk = (id: string, depth: number) => {
    for (const child of childrenOf.get(id) ?? []) {
      out.push({ dept: child, depth })
      walk(child.id, depth + 1)
    }
  }
  walk(deptId, 0)
  return out
}

/** Root → … → self chain for a department, for the breadcrumb. */
export function ancestorsOf(departments: Department[], deptId: string): Department[] {
  const byId = new Map(departments.map((d) => [d.id, d]))
  const chain: Department[] = []
  let current = byId.get(deptId)
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current)
    const pid = current.parent_department_id
    current = pid ? byId.get(pid) : undefined
  }
  return chain
}
