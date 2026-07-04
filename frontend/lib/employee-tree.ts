import type { Department, EmployeeProfile } from './types'
import { rankOfLevel } from './role-levels'

/**
 * Builds the reporting forest from employees' `reporting_to_user_id` and lays it
 * out (Reingold–Tilford) for the employee org chart. Free radicals — people with
 * no in-set manager AND nobody reporting to them — are grouped by department in a
 * band below the connected forest, so they sit near their department.
 */

export interface XY {
  x: number
  y: number
}

// Node footprint + spacing.
export const NODE_W = 210
export const NODE_H = 92
const H_SPACING = 232
const V_SPACING = 132

export interface EmployeeForest {
  byUser: Map<string, EmployeeProfile>
  childrenOf: Map<string, EmployeeProfile[]> // manager user_id → reports (in set)
  connectedRoots: EmployeeProfile[] // roots that have descendants
  freeRadicals: EmployeeProfile[] // no in-set manager and no in-set reports
}

const sortPeople = (arr: EmployeeProfile[]) =>
  [...arr].sort(
    (a, b) =>
      rankOfLevel(a.role?.level) - rankOfLevel(b.role?.level) ||
      (a.user?.name ?? '').localeCompare(b.user?.name ?? ''),
  )

export interface BuildForestOpts {
  /**
   * A root with no in-set reports normally lands in the free-radical band. When
   * the set is filtered (e.g. by department), some of those roots actually DO
   * have connections — a manager or reports that were filtered out. Return true
   * only for people who are genuinely unlinked in the FULL org (no manager and
   * no reports at all); the rest stay in the forest as standalone roots (they
   * carry a "hidden neighbour" dot instead). Defaults to treating every
   * reportless root as a free radical (unfiltered behaviour).
   */
  isGenuinelyUnlinked?: (e: EmployeeProfile) => boolean
}

export function buildEmployeeForest(
  employees: EmployeeProfile[],
  opts?: BuildForestOpts,
): EmployeeForest {
  const byUser = new Map<string, EmployeeProfile>()
  for (const e of employees) byUser.set(e.user_id, e)

  const childrenOf = new Map<string, EmployeeProfile[]>()
  const roots: EmployeeProfile[] = []
  for (const e of employees) {
    const mgr = e.reporting_to_user_id
    if (mgr && byUser.has(mgr) && mgr !== e.user_id) {
      const arr = childrenOf.get(mgr)
      if (arr) arr.push(e)
      else childrenOf.set(mgr, [e])
    } else {
      roots.push(e)
    }
  }
  childrenOf.forEach((arr, k) => childrenOf.set(k, sortPeople(arr)))

  const hasReports = (e: EmployeeProfile) => (childrenOf.get(e.user_id)?.length ?? 0) > 0
  const isFree = opts?.isGenuinelyUnlinked ?? (() => true)
  // A root anchors the forest if it has in-set reports, or if it isn't genuinely
  // unlinked (its manager/reports were merely filtered out — shown with a dot).
  const connectedRoots = sortPeople(roots.filter((e) => hasReports(e) || !isFree(e)))
  const freeRadicals = sortPeople(roots.filter((e) => !hasReports(e) && isFree(e)))

  return { byUser, childrenOf, connectedRoots, freeRadicals }
}

/** Reingold–Tilford positions for the connected forest, keyed by employee id. */
export function computeForestLayout(forest: EmployeeForest): {
  pos: Record<string, XY>
  width: number
  height: number
} {
  const { childrenOf, connectedRoots, byUser } = forest
  const pos: Record<string, XY> = {}
  let nextLeafX = 0
  let maxDepth = 0

  const layout = (userId: string, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth)
    const emp = byUser.get(userId)!
    const kids = childrenOf.get(userId) ?? []
    const y = depth * V_SPACING
    let x: number
    if (kids.length === 0) {
      x = nextLeafX * H_SPACING
      nextLeafX += 1
    } else {
      const xs = kids.map((k) => layout(k.user_id, depth + 1))
      x = (xs[0] + xs[xs.length - 1]) / 2
    }
    pos[emp.id] = { x, y }
    return x
  }

  for (const r of connectedRoots) layout(r.user_id, 0)

  const width = Math.max(0, nextLeafX) * H_SPACING
  const height = (maxDepth + 1) * V_SPACING
  return { pos, width, height }
}

export interface FreeRadicalCluster {
  dept: Department | null
  people: EmployeeProfile[]
}

/** Free radicals grouped by department (dept order = the given list's order). */
export function groupFreeRadicalsByDept(
  freeRadicals: EmployeeProfile[],
  departments: Department[],
): FreeRadicalCluster[] {
  const order = new Map(departments.map((d, i) => [d.id, i]))
  const byDept = new Map<string, EmployeeProfile[]>()
  for (const e of freeRadicals) {
    const arr = byDept.get(e.department_id)
    if (arr) arr.push(e)
    else byDept.set(e.department_id, [e])
  }
  const deptById = new Map(departments.map((d) => [d.id, d]))
  return Array.from(byDept.entries())
    .sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999))
    .map(([deptId, people]) => ({ dept: deptById.get(deptId) ?? null, people: sortPeople(people) }))
}

/**
 * Lay out free-radical clusters in a band below the forest: each department's
 * people wrap into a row, clusters stacked vertically. Returns per-employee
 * positions plus per-cluster label anchors.
 */
export function layoutFreeRadicals(
  clusters: FreeRadicalCluster[],
  startY: number,
  maxWidth: number,
): { pos: Record<string, XY>; labels: { dept: Department | null; x: number; y: number }[] } {
  const pos: Record<string, XY> = {}
  const labels: { dept: Department | null; x: number; y: number }[] = []
  const perRow = Math.max(1, Math.floor(maxWidth / H_SPACING) || 4)
  let y = startY + V_SPACING

  for (const cluster of clusters) {
    labels.push({ dept: cluster.dept, x: 0, y: y - 36 })
    cluster.people.forEach((e, i) => {
      const col = i % perRow
      const row = Math.floor(i / perRow)
      pos[e.id] = { x: col * H_SPACING, y: y + row * V_SPACING }
    })
    const rows = Math.ceil(cluster.people.length / perRow)
    y += rows * V_SPACING + V_SPACING * 0.6
  }
  return { pos, labels }
}
