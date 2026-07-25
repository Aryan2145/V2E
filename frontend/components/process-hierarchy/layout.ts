// Lightweight left-to-right layered auto-layout for a single flow level — no external
// graph library. Nodes with no incoming edge start at the left; each edge pushes its
// target one column right (longest-path layering); nodes in the same column stack down.
import type { ProcessNode, ProcessConnection } from '@/lib/api/process-hierarchy'

const COL = 300
const ROW = 170
const X0 = 60
const Y0 = 60

export function autoLayout(
  nodes: ProcessNode[],
  connections: ProcessConnection[],
): Record<string, { x: number; y: number }> {
  const ids = nodes.map((n) => n.id)
  const idset = new Set(ids)
  const outgoing = new Map<string, string[]>()
  const indeg = new Map<string, number>()
  ids.forEach((id) => { outgoing.set(id, []); indeg.set(id, 0) })
  connections.forEach((c) => {
    if (idset.has(c.source_node_id) && idset.has(c.target_node_id)) {
      outgoing.get(c.source_node_id)!.push(c.target_node_id)
      indeg.set(c.target_node_id, (indeg.get(c.target_node_id) || 0) + 1)
    }
  })

  // Longest-path layering via a relaxation BFS from the sources.
  const layer = new Map<string, number>()
  const remainingIn = new Map(indeg)
  const q = ids.filter((id) => (indeg.get(id) || 0) === 0)
  q.forEach((id) => layer.set(id, 0))
  let guard = 0
  while (q.length && guard++ < ids.length * ids.length + ids.length) {
    const id = q.shift()!
    const l = layer.get(id) || 0
    for (const t of outgoing.get(id)!) {
      layer.set(t, Math.max(layer.get(t) ?? 0, l + 1))
      remainingIn.set(t, (remainingIn.get(t) || 1) - 1)
      if ((remainingIn.get(t) || 0) <= 0) q.push(t)
    }
  }
  // Isolated nodes / cycle members that never resolved → column 0.
  ids.forEach((id) => { if (!layer.has(id)) layer.set(id, 0) })

  // Keep the map's existing vertical order stable within each column.
  const order = new Map(ids.map((id, i) => [id, i]))
  const byLayer = new Map<number, string[]>()
  ids.forEach((id) => {
    const l = layer.get(id)!
    const arr = byLayer.get(l) ?? []
    arr.push(id)
    byLayer.set(l, arr)
  })

  const pos: Record<string, { x: number; y: number }> = {}
  Array.from(byLayer.keys()).sort((a, b) => a - b).forEach((l) => {
    const arr = byLayer.get(l)!.sort((a, b) => (order.get(a)! - order.get(b)!))
    arr.forEach((id, i) => { pos[id] = { x: X0 + l * COL, y: Y0 + i * ROW } })
  })

  // Decision fan-out: keep the YES branch level with the diamond and drop the NO branch
  // one row below, so the two output lines spread apart instead of drawing on top of
  // each other. (yes exits the right, no exits the bottom — different y separates them.)
  const kindOf = new Map(nodes.map((n) => [n.id, n.kind]))
  for (const d of nodes) {
    if (kindOf.get(d.id) !== 'decision') continue
    const outs = connections.filter((c) => c.source_node_id === d.id && idset.has(c.target_node_id))
    const yes = outs.find((c) => c.condition_kind !== 'no')?.target_node_id
    const no = outs.find((c) => c.condition_kind === 'no')?.target_node_id
    if (yes && pos[yes]) pos[yes].y = pos[d.id].y
    if (no && pos[no]) pos[no].y = pos[d.id].y + ROW
  }

  // De-overlap every column: two nodes sharing a column may never sit closer than one
  // row, so nothing overlaps after the decision nudges above. Columns are COL apart, so
  // cross-column nodes never overlap horizontally.
  const cols = new Map<number, string[]>()
  ids.forEach((id) => { const a = cols.get(pos[id].x) ?? []; a.push(id); cols.set(pos[id].x, a) })
  cols.forEach((arr) => {
    arr.sort((a, b) => pos[a].y - pos[b].y)
    for (let i = 1; i < arr.length; i++) {
      const minY = pos[arr[i - 1]].y + ROW
      if (pos[arr[i]].y < minY) pos[arr[i]].y = minY
    }
  })
  return pos
}
