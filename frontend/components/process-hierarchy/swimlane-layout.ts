// Swimlane layout for the process explorer (Phase 2).
//
// Arranges one flow level's steps into stacked BPMN pools with department lanes:
//   Customer (top) · Company [dept lanes…] · Vendor · then lane-less steps below (no band).
// Each lane is a single left→right row: a step is placed in the next free column of its
// lane, so new steps land to the RIGHT of existing ones, never stacked underneath. Columns
// still respect the flow order (longest-path depth) so connected steps read left→right and
// downstream steps sit further right. Connections within a pool are solid; across pools dotted.
import { MarkerType, type Edge, type Node } from 'reactflow'
import type { FlowLevel, ProcessNode, ProcessPool } from '@/lib/api/process-hierarchy'
import type { ProcessNodeData, SwimlaneBandData } from './nodes'

const DRILLABLE = new Set(['container', 'subprocess'])

const POOL_LABEL_W = 30 // left strip for the pool label (vertical text)
const LANE_LABEL_W = 30 // second strip for the lane (department) label
export const CONTENT_X = POOL_LABEL_W + LANE_LABEL_W + 20 // left edge of content; also the min x for a dragged node
const COL_GAP = 56
const ROW_H = 112 // height of a lane's single row (all steps sit on one line; no row-dropping)
const BAND_PAD = 14 // vertical padding inside a lane band
const NODE_H = 96 // fixed wrapper height for every step (keeps handles aligned → straight lines)
const RIGHT_PAD = 80
const LOOSE_GAP = 44 // gap below the pools where lane-less steps sit

function sizeForKind(kind: string): { w: number; h: number } {
  if (kind === 'container') return { w: 220, h: 88 }
  if (kind === 'decision') return { w: 96, h: 96 }
  if (kind === 'start_event' || kind === 'end_event') return { w: 60, h: 60 }
  return { w: 170, h: 64 } // task, subprocess
}

// A node's pool "group" for the cross-pool (message-flow) test. Lane-less steps group as
// 'none' — a connection between two of those stays solid.
type PoolGroup = ProcessPool | 'none'
const groupOf = (n: Pick<ProcessNode, 'pool'>): PoolGroup => (n.pool ?? 'none')

export interface SwimlaneOpts {
  selectedNodeId: string | null
  canEdit: boolean
  diffStatus?: Record<string, any> | null
  onEdit: (realNodeId: string) => void
  // Add a step straight into a lane (from the lane's "+"). deptId is null for Customer/Vendor.
  onAddInLane?: (pool: ProcessPool, departmentId: string | null) => void
}

interface Band { key: string; variant: 'pool' | 'lane'; label: string; pool: ProcessPool; deptId: string | null }

export interface LaneBand { pool: ProcessPool; deptId: string | null; yTop: number; yBottom: number }

export function buildSwimlane(
  flow: FlowLevel,
  opts: SwimlaneOpts,
): { nodes: Node<any>[]; edges: Edge[]; meta: Record<string, { mapId: string; realId: string }>; laneBands: LaneBand[] } {
  const steps = flow.nodes.filter((n) => n.kind !== 'note')
  const nodeById = new Map(steps.map((n) => [n.id, n]))
  const idset = new Set(steps.map((n) => n.id))

  // ── Longest-path depth per node (respects the drawn flow). ──
  const outgoing = new Map<string, string[]>()
  const indeg = new Map<string, number>()
  steps.forEach((n) => { outgoing.set(n.id, []); indeg.set(n.id, 0) })
  flow.connections.forEach((c) => {
    if (idset.has(c.source_node_id) && idset.has(c.target_node_id)) {
      outgoing.get(c.source_node_id)!.push(c.target_node_id)
      indeg.set(c.target_node_id, (indeg.get(c.target_node_id) || 0) + 1)
    }
  })
  const layerOf = new Map<string, number>()
  const remaining = new Map(indeg)
  const q = steps.map((n) => n.id).filter((id) => (indeg.get(id) || 0) === 0)
  q.forEach((id) => layerOf.set(id, 0))
  let guard = 0
  while (q.length && guard++ < steps.length * steps.length + steps.length) {
    const id = q.shift()!
    const l = layerOf.get(id) || 0
    for (const t of outgoing.get(id)!) {
      layerOf.set(t, Math.max(layerOf.get(t) ?? 0, l + 1))
      remaining.set(t, (remaining.get(t) || 1) - 1)
      if ((remaining.get(t) || 0) <= 0) q.push(t)
    }
  }
  steps.forEach((n) => { if (!layerOf.has(n.id)) layerOf.set(n.id, 0) })

  const bandKeyOf = (n: ProcessNode): string => {
    if (n.pool === 'company' && n.department_id) return 'lane:' + n.department_id
    if (n.pool === 'customer') return 'pool:customer'
    if (n.pool === 'vendor') return 'pool:vendor'
    return 'loose'
  }

  // ── Per-lane left→right cascade: within a lane, each step takes the next free column
  // (max of its flow-depth and the lane's running column), so steps never stack. ──
  const ordered = [...steps].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const colOf = new Map<string, number>()
  const laneNext = new Map<string, number>()
  for (const n of ordered) {
    const key = bandKeyOf(n)
    const col = Math.max(layerOf.get(n.id) ?? 0, laneNext.get(key) ?? 0)
    colOf.set(n.id, col)
    laneNext.set(key, col + 1)
  }

  const maxCol = colOf.size ? Math.max(...Array.from(colOf.values())) : 0
  const widthOfCol = new Map<number, number>()
  for (const n of steps) {
    const c = colOf.get(n.id)!
    widthOfCol.set(c, Math.max(widthOfCol.get(c) ?? 0, sizeForKind(n.kind).w))
  }
  // A connection's label sits in the gap between its two columns — widen that gap so the label
  // isn't squeezed and the line stays visible on both sides of it.
  const labelText = (c: FlowLevel['connections'][number]) => c.label || (c.condition_kind !== 'none' ? c.condition_kind.toUpperCase() : '')
  const gapForCol = new Map<number, number>()
  for (const c of flow.connections) {
    const sc = colOf.get(c.source_node_id), tc = colOf.get(c.target_node_id)
    const lab = labelText(c)
    if (sc == null || tc == null || !lab || tc <= sc) continue
    const need = lab.length * 7 + 40 // rough label width + breathing room for line on each side
    for (let g = sc; g < tc; g++) gapForCol.set(g, Math.max(gapForCol.get(g) ?? 0, Math.ceil(need / (tc - sc))))
  }
  const colX = new Map<number, number>()
  let cx = CONTENT_X
  for (let c = 0; c <= maxCol; c++) {
    colX.set(c, cx)
    cx += (widthOfCol.get(c) ?? 170) + Math.max(COL_GAP, gapForCol.get(c) ?? 0)
  }
  // A node dragged horizontally keeps its stored x; otherwise it flows in its auto column.
  // (Vertical is always the lane row — horizontal is the only thing the user places by hand.)
  const xOf = (id: string) => {
    const px = nodeById.get(id)?.position_x ?? 0
    return px >= CONTENT_X ? px : (colX.get(colOf.get(id) ?? 0) ?? CONTENT_X)
  }

  // ── Rows within a lane. Only a decision with MORE THAN ONE branch drops its extra branch(es)
  // to lower rows so they don't overlap (Yes stays on the line, No drops below). A single branch
  // never drops (no needless inverted-S). Downstream inherits its row; merges rejoin upward. ──
  const rankCond = (c: string) => (c === 'yes' ? 0 : c === 'no' ? 1 : 2)
  const outBySource = new Map<string, { target: string; cond: string }[]>()
  const incoming = new Map<string, { src: string; cond: string }[]>()
  flow.connections.forEach((c) => {
    if (!idset.has(c.source_node_id) || !idset.has(c.target_node_id)) return
    ;(outBySource.get(c.source_node_id) ?? outBySource.set(c.source_node_id, []).get(c.source_node_id)!).push({ target: c.target_node_id, cond: c.condition_kind })
    ;(incoming.get(c.target_node_id) ?? incoming.set(c.target_node_id, []).get(c.target_node_id)!).push({ src: c.source_node_id, cond: c.condition_kind })
  })
  const branchOffset = new Map<string, number>() // "src->target" → extra rows below the source
  for (const [src, outs] of Array.from(outBySource.entries())) {
    if (nodeById.get(src)?.kind !== 'decision' || outs.length <= 1) continue
    // Only branches that land in the SAME lane collide — stack those. Branches in different lanes
    // are already separated, so they stay on their own row 0.
    const byTargetBand = new Map<string, { target: string; cond: string }[]>()
    for (const o of outs) {
      const tn = nodeById.get(o.target)
      const bk = tn ? bandKeyOf(tn) : 'loose'
      ;(byTargetBand.get(bk) ?? byTargetBand.set(bk, []).get(bk)!).push(o)
    }
    for (const group of Array.from(byTargetBand.values())) {
      if (group.length > 1) group.sort((a, b) => rankCond(a.cond) - rankCond(b.cond)).forEach((o, i) => branchOffset.set(src + '->' + o.target, i))
    }
  }
  const rowOf = new Map<string, number>()
  steps.forEach((n) => rowOf.set(n.id, 0))
  const byCol = [...steps].sort((a, b) => (colOf.get(a.id)! - colOf.get(b.id)!) || ((a.sort_order ?? 0) - (b.sort_order ?? 0)))
  for (const n of byCol) {
    const ins = incoming.get(n.id) ?? []
    if (!ins.length) continue
    let r = Infinity
    for (const e of ins) r = Math.min(r, (rowOf.get(e.src) ?? 0) + (branchOffset.get(e.src + '->' + n.id) ?? 0))
    if (r !== Infinity) rowOf.set(n.id, r)
  }

  // ── Bands, top→bottom (Customer · Company lanes · Vendor). No "Unassigned" band. ──
  const bands: Band[] = []
  if (steps.some((n) => n.pool === 'customer')) bands.push({ key: 'pool:customer', variant: 'pool', label: 'Customer', pool: 'customer', deptId: null })
  const companyStart = bands.length
  const hasCompany = flow.lanes.length > 0 || steps.some((n) => n.pool === 'company')
  if (hasCompany) for (const lane of flow.lanes) bands.push({ key: 'lane:' + lane.department_id, variant: 'lane', label: lane.department_name, pool: 'company', deptId: lane.department_id })
  const companyEnd = bands.length
  if (steps.some((n) => n.pool === 'vendor')) bands.push({ key: 'pool:vendor', variant: 'pool', label: 'Vendor', pool: 'vendor', deptId: null })

  // A lane is as many rows tall as its deepest branch needs (≥1).
  const byBand = new Map<string, string[]>()
  for (const n of steps) { const k = bandKeyOf(n); (byBand.get(k) ?? byBand.set(k, []).get(k)!).push(n.id) }
  const bandHeightOf = (b: Band) => {
    const ids = byBand.get(b.key) ?? []
    const rows = ids.length ? Math.max(...ids.map((id) => rowOf.get(id) ?? 0)) + 1 : 1
    return rows * ROW_H + 2 * BAND_PAD
  }

  // Stack bands top→bottom. Lanes inside the Company pool are flush; a gap separates the
  // three pools (Customer / Company / Vendor) so they don't share borders.
  const POOL_GAP = 28
  const bandY = new Map<string, number>()
  const bandH = new Map<string, number>()
  let y = 0
  let prevPool: ProcessPool | null = null
  for (const b of bands) {
    if (prevPool !== null && b.pool !== prevPool) y += POOL_GAP
    const h = bandHeightOf(b)
    bandY.set(b.key, y); bandH.set(b.key, h); y += h
    prevPool = b.pool
  }
  const bandsBottom = y
  const laneBands: LaneBand[] = bands.map((b) => ({ pool: b.pool, deptId: b.deptId, yTop: bandY.get(b.key)!, yBottom: bandY.get(b.key)! + bandH.get(b.key)! }))

  const maxRight = steps.length ? Math.max(...steps.map((n) => xOf(n.id) + sizeForKind(n.kind).w)) : CONTENT_X
  const totalWidth = maxRight + RIGHT_PAD

  // ── Band backgrounds. ──
  const nodes: Node<any>[] = []
  if (companyEnd > companyStart) {
    const top = bandY.get(bands[companyStart].key)!
    const bottom = bandY.get(bands[companyEnd - 1].key)! + bandH.get(bands[companyEnd - 1].key)!
    nodes.push({
      id: 'band::pool:company', type: 'swimlane', position: { x: 0, y: top },
      draggable: false, selectable: false, zIndex: 0,
      style: { width: totalWidth, height: bottom - top, pointerEvents: 'none' },
      data: { label: 'Company', variant: 'pool' } as SwimlaneBandData,
    })
  }
  for (const b of bands) {
    const isLane = b.variant === 'lane'
    nodes.push({
      id: 'band::' + b.key, type: 'swimlane',
      position: { x: isLane ? POOL_LABEL_W : 0, y: bandY.get(b.key)! },
      draggable: false, selectable: false, zIndex: 1,
      style: { width: totalWidth - (isLane ? POOL_LABEL_W : 0), height: bandH.get(b.key)!, pointerEvents: 'none' },
      data: {
        label: b.label, variant: b.variant,
        onAdd: opts.onAddInLane ? () => opts.onAddInLane!(b.pool, b.deptId) : undefined,
      } as SwimlaneBandData,
    })
  }

  // ── Step nodes: placed at (column, row) within their lane; lane-less steps sit below the
  // pools. Every step gets the SAME wrapper height with content vertically centred, so the
  // left/right handles sit at one shared height per row — connectors stay straight even when
  // a task and a taller decision sit side by side (that mismatch is what bent the line). ──
  const meta: Record<string, { mapId: string; realId: string }> = {}
  const centerOf = new Map<string, { cx: number; cy: number }>()
  for (const n of steps) {
    const key = bandKeyOf(n)
    const px = xOf(n.id)
    // Lane-less nodes (e.g. containers) are placed freely — honour their stored y, else drop
    // them into a strip below the pools. Pooled steps are locked to their lane row.
    const py = key === 'loose'
      ? ((n.position_y ?? 0) > 0 ? (n.position_y as number) : bandsBottom + LOOSE_GAP + (ROW_H - NODE_H) / 2)
      : (bandY.get(key) ?? 0) + BAND_PAD + (rowOf.get(n.id) ?? 0) * ROW_H + (ROW_H - NODE_H) / 2
    centerOf.set(n.id, { cx: px + sizeForKind(n.kind).w / 2, cy: py + NODE_H / 2 })
    meta[n.id] = { mapId: flow.map_id, realId: n.id }
    nodes.push({
      id: n.id, type: 'process', position: { x: px, y: py },
      draggable: opts.canEdit, selectable: true, zIndex: 2,
      style: { height: NODE_H, display: 'flex', alignItems: 'center' },
      data: {
        name: n.name, kind: n.kind, childCount: n.child_count ?? 0,
        docCount: (n.inputs?.length ?? 0) + (n.outputs?.length ?? 0),
        checklist: n.checklist ?? [],
        drillable: DRILLABLE.has(n.kind),
        selected: n.id === opts.selectedNodeId,
        diff: opts.diffStatus?.[n.id],
        linkedMapName: n.linked_map_name ?? null,
        onEdit: () => opts.onEdit(n.id),
      } as ProcessNodeData,
    })
  }

  // ── Edges: solid within a pool, dotted (message) across pools; orthogonal routing. ──
  const edges: Edge[] = []
  for (const c of flow.connections) {
    const s = nodeById.get(c.source_node_id)
    const t = nodeById.get(c.target_node_id)
    if (!s || !t) continue
    const crossPool = groupOf(s) !== groupOf(t)
    const fromDecision = s.kind === 'decision'
    const label = c.label || (c.condition_kind !== 'none' ? c.condition_kind.toUpperCase() : '')
    const color = crossPool ? '#64748B' : '#475569'
    // A decision's line leaves from the side that actually faces its target, so it stays
    // straight: same lane/row → exit RIGHT (straight across); a target in a different pool/
    // lane → exit BOTTOM or TOP (straight down/up). Never a U-turn. Yes/No is the label.
    let sourceHandle: string | undefined
    if (fromDecision) {
      const sc = centerOf.get(c.source_node_id), tc = centerOf.get(c.target_node_id)
      if (!sc || !tc || Math.abs(tc.cy - sc.cy) < 4) sourceHandle = 'right' // same height → straight across
      else sourceHandle = tc.cy > sc.cy ? 'bottom' : 'top' // lower → exit bottom, higher → exit top
    }
    edges.push({
      id: c.id,
      source: c.source_node_id,
      target: c.target_node_id,
      sourceHandle,
      type: 'smoothstep',
      label: label || undefined,
      labelStyle: { fontSize: 11, fontWeight: 600, fill: '#475569' },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.85 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 12 },
      style: { stroke: color, strokeWidth: 1.6, ...(crossPool ? { strokeDasharray: '5 4' } : {}) },
      zIndex: 1,
    } as Edge)
  }

  return { nodes, edges, meta, laneBands }
}
