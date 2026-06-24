/**
 * Department-tree helpers for holiday cascade resolution.
 *
 * Departments form a strict tree via `parent_department_id` (same structure the
 * frontend walks in `lib/dept-tree.ts`). The backend had no traversal of its
 * own, so this mirrors that algorithm id-side: build a children map once, then
 * derive descendants (cascade reach) and ancestor chains (inheritance lookup).
 */

export interface DeptNode {
  id: string
  parent_department_id: string | null
}

/** parentId → child ids, restricted to departments present in the set. */
export function buildChildrenMap(depts: DeptNode[]): Map<string, string[]> {
  const ids = new Set(depts.map((d) => d.id))
  const childrenOf = new Map<string, string[]>()
  for (const d of depts) {
    const pid = d.parent_department_id
    if (pid && ids.has(pid)) {
      const arr = childrenOf.get(pid)
      if (arr) arr.push(d.id)
      else childrenOf.set(pid, [d.id])
    }
  }
  return childrenOf
}

/** All descendants of `rootId` at any depth (excludes the root itself). */
export function descendantIds(depts: DeptNode[], rootId: string): Set<string> {
  const childrenOf = buildChildrenMap(depts)
  const out = new Set<string>()
  const stack = [...(childrenOf.get(rootId) ?? [])]
  while (stack.length) {
    const id = stack.pop()!
    if (out.has(id)) continue // guard against accidental cycles
    out.add(id)
    for (const c of childrenOf.get(id) ?? []) stack.push(c)
  }
  return out
}

/**
 * Ancestor chain for `deptId` from the root down to (and including) itself,
 * e.g. [Sales, West Zone, Gujarat, Vadodara]. Used to find which ancestor a
 * holiday originates from and to walk the opt-out path between them.
 */
export function ancestorChain(depts: DeptNode[], deptId: string): string[] {
  const byId = new Map(depts.map((d) => [d.id, d]))
  const chain: string[] = []
  const seen = new Set<string>()
  let cur = byId.get(deptId)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    chain.unshift(cur.id)
    const pid = cur.parent_department_id
    cur = pid ? byId.get(pid) : undefined
  }
  return chain
}

/** A cascaded holiday reduced to what decides its reach: origin, targets, opt-outs. */
export interface CascadeReach {
  originId: string
  targetIds: string[]
  optOutIds: string[]
}

/**
 * Whether a cascaded holiday reaches `deptId`, given that department's ancestor
 * chain (root → … → deptId). It reaches the department iff the department is a
 * target AND no opt-out sits on the path from the origin (exclusive) down to it.
 * That path rule is what makes an opt-out flow DOWN only — a sibling or the
 * parent has a different path that never contains the opted-out node.
 */
export function holidayReaches(chain: string[], deptId: string, h: CascadeReach): boolean {
  if (!h.targetIds.includes(deptId)) return false
  const originIdx = chain.indexOf(h.originId)
  if (originIdx === -1) return false // origin isn't an ancestor of this dept
  const pathNodes = chain.slice(originIdx + 1) // child-of-origin … deptId (inclusive)
  return !h.optOutIds.some((o) => pathNodes.includes(o))
}

/** A department's opt-out of an ORG holiday: the anchor department and whether it reaches descendants. */
export interface OrgOptOutAnchor {
  departmentId: string
  appliesToSubtree: boolean
}

/**
 * Whether an org holiday is suppressed for `deptId`, given that department's ancestor
 * chain (root → … → deptId) and the org-holiday opt-outs anchored anywhere in the org.
 * It is suppressed iff some anchor `A` lies on this department's chain (deptId included)
 * with `A === deptId` (a same-department opt-out always suppresses the anchor) OR
 * `appliesToSubtree` (an ancestor's opt-out that the remover chose to cascade down).
 * A sibling's opt-out never appears on this chain, so the effect flows DOWN only.
 */
export function orgHolidaySuppressed(chain: string[], deptId: string, optOuts: OrgOptOutAnchor[]): boolean {
  const chainSet = new Set(chain)
  return optOuts.some(
    (o) => chainSet.has(o.departmentId) && (o.departmentId === deptId || o.appliesToSubtree),
  )
}
