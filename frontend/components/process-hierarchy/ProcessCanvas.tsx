'use client'

import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  useStoreApi,
  getRectOfNodes,
  getTransformForBounds,
  ReactFlowProvider,
  BackgroundVariant,
  MarkerType,
  SelectionMode,
  type Node,
  type Edge,
  type Connection,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Trash2, X, Maximize2, Minimize2, Copy } from 'lucide-react'
import { nodeTypes, type ProcessNodeData } from './nodes'
import FloatingEdge from './floating-edge'
import { buildNested, type NodeMeta, type SubDesc } from './nested-render'
import { buildSwimlane, CONTENT_X, type LaneBand } from './swimlane-layout'
import StyledSelect from '@/components/ui/StyledSelect'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const edgeTypes = { floating: FloatingEdge }
import type { FlowLevel, ProcessConditionKind, ProcessConnection, DiffChangeKind, ProcessPool } from '@/lib/api/process-hierarchy'

interface Props {
  flow: FlowLevel
  canEdit: boolean
  swimlane?: boolean // render the pool/lane layout instead of the free-form canvas
  onAddInLane?: (pool: ProcessPool, departmentId: string | null) => void // lane "+" in swimlane view
  onAppendFromNode?: (nodeId: string, pool: ProcessPool | null, departmentId: string | null, sourceSide?: string) => void // click a node's exit dot → append a connected step
  onDecisionConnect?: (source: string, target: string, sourceSide?: string) => void // drag FROM a decision → choose Yes/No in a pop-up
  onReassignLane?: (nodeId: string, pool: ProcessPool, departmentId: string | null, positionX: number) => void // drag a node onto another lane → change its department (+ keep its horizontal spot)
  selectedNodeId: string | null
  visibleNodeIds: Set<string> | null // null = show all
  diffStatus?: Record<string, DiffChangeKind> | null // when comparing versions
  onSelectNode: (nodeId: string) => void
  onDrill: (nodeId: string) => void
  onConnect: (source: string, target: string, condition: ProcessConditionKind, sourceSide?: string) => void
  onNodeDragStop: (nodeId: string, x: number, y: number) => void
  onUpdateConnection?: (id: string, dto: { label?: string; condition_kind?: ProcessConditionKind }) => void
  onDeleteConnection?: (id: string) => void
  // Box-select support: persist a group's new canvas positions, and delete a group.
  onNodesMove?: (positions: { id: string; position_x: number; position_y: number }[]) => void
  onDeleteNodes?: (ids: string[]) => Promise<void> | void
  // Rendered as the rightmost item in the canvas's top-right control cluster
  // (used to float the page's "Add step" primary over the canvas).
  topRightExtra?: React.ReactNode
  // Phase-3: fetch an area's inner flow so it can be unfolded inline — either a
  // referenced map (getFlow(mapId, null)) or a drill-down container (getFlow(mapId, nodeId)).
  loadFlowAt?: (mapId: string, parentNodeId: string | null) => Promise<FlowLevel>
  // Preview a document (input/output) clicked straight on the canvas.
  onOpenDoc?: (artifactId: string) => void
  // Filled by the canvas with a fn that returns the flow-coords at the centre of what's
  // on screen right now — so a newly added node lands where the user is looking.
  spawnCenterRef?: React.MutableRefObject<(() => { x: number; y: number }) | null>
  // Lets the page trigger a PNG export from its ⋯ menu (the button no longer sits on the canvas).
  exportPngRef?: React.MutableRefObject<(() => void) | null>
  // Copy the given nodes to the clipboard (from the multi-select action bar).
  onCopyNodes?: (ids: string[]) => void
  // Paste the clipboard into the current level (Ctrl/Cmd+V).
  onPaste?: () => void
  // Open a different map (clicking an unfolded inline child drills into its own map).
  onOpenMap?: (mapId: string) => void
}

const DRILLABLE = new Set(['container', 'subprocess'])

// Fit whenever a level loads/changes. maxZoom 1 keeps sparse maps from blowing up
// past 100%; the uniform padding also keeps the top row clear of the floating
// hint toast and Add-step button.
// minZoom 0.6 keeps node text legible after a fit — on a big map it won't cram
// everything in (you pan), but nothing shrinks to an unreadable size.
const FIT_OPTIONS = { padding: 0.2, minZoom: 0.6, maxZoom: 1, duration: 300 }
// Below this zoom, unfolded areas fold back to boxes (semantic zoom). Kept under the
// fit minZoom (0.6) so auto-fitting an expand never trips it.
const LOD_THRESHOLD = 0.5

// A short ease on the viewport transform turns the discrete wheel-scroll / zoom steps into
// smooth glides. Node-dragging is unaffected (nodes live inside the viewport). The ph-no-anim
// class is toggled on during a scrollbar-thumb drag so that stays 1:1 with the pointer.
const PH_CANVAS_CSS = `
.ph-canvas .react-flow__viewport { transition: transform 90ms ease-out; }
.ph-canvas .react-flow__viewport.ph-no-anim { transition: none; }
`

// Panning is bounded to the map's content plus this margin (breathing room, not infinite space).
// The scrollbars use the SAME margin, so a bar shows exactly when that axis can scroll, and the
// thumb maps 1:1 to the real scroll range.
const PAN_PAD = 300

function Inner({
  flow, canEdit, swimlane = false, onAddInLane, onAppendFromNode, onDecisionConnect, onReassignLane, selectedNodeId, visibleNodeIds, diffStatus,
  onSelectNode, onDrill, onConnect, onNodeDragStop, onUpdateConnection, onDeleteConnection,
  onNodesMove, onDeleteNodes, topRightExtra, loadFlowAt, onOpenMap, onOpenDoc, spawnCenterRef, onCopyNodes, onPaste, exportPngRef,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [edgeEdit, setEdgeEdit] = useState<{ conn: ProcessConnection; x: number; y: number; label: string } | null>(null)

  // Inline expand/collapse of referenced areas (Phase-3 spike).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [childFlows, setChildFlows] = useState<Record<string, FlowLevel>>({})
  const fetchSub = useCallback((desc: SubDesc) => {
    if (childFlows[desc.contentKey] || !loadFlowAt) return
    const p = desc.linkedMapId ? loadFlowAt(desc.linkedMapId, null) : loadFlowAt(desc.mapId, desc.nodeId)
    p.then((f) => setChildFlows((c) => ({ ...c, [desc.contentKey]: f }))).catch(() => {})
  }, [childFlows, loadFlowAt])
  const toggleExpand = useCallback((renderedId: string, desc: SubDesc) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(renderedId)) next.delete(renderedId)
      else { next.add(renderedId); fetchSub(desc) }
      return next
    })
  }, [fetchSub])

  const connById = useMemo(() => new Map(flow.connections.map((c) => [c.id, c])), [flow.connections])
  const kindById = useMemo(() => new Map(flow.nodes.map((n) => [n.id, n.kind])), [flow.nodes])

  // Semantic zoom: this only flips when the zoom crosses the LOD threshold (the
  // selector returns a boolean, so panning/fine zooming doesn't re-render the tree).
  const lodCollapse = useStore((s) => s.transform[2] < LOD_THRESHOLD)

  // Recursive nested render (top level + any unfolded areas, to any depth) — OR the
  // swimlane layout (pools + department lanes) when the Swimlane view is on.
  const metaRef = useRef<NodeMeta>({})
  const laneBandsRef = useRef<LaneBand[]>([])
  const { rfNodes, rfEdges } = useMemo(() => {
    if (swimlane) {
      const built = buildSwimlane(flow, {
        selectedNodeId, canEdit, diffStatus: diffStatus ?? null, onEdit: onSelectNode, onAddInLane,
      })
      metaRef.current = built.meta
      laneBandsRef.current = built.laneBands
      return { rfNodes: built.nodes, rfEdges: built.edges }
    }
    laneBandsRef.current = []
    const built = buildNested(flow, {
      childFlows, expandedIds, currentMapId: flow.map_id, canEdit,
      selectedNodeId, diffStatus: diffStatus ?? null, visibleNodeIds,
      onEdit: onSelectNode, onToggleExpand: toggleExpand, onOpenDoc, lodCollapse,
    })
    metaRef.current = built.meta
    return { rfNodes: built.nodes, rfEdges: built.edges }
  }, [swimlane, onAddInLane, flow, childFlows, expandedIds, canEdit, selectedNodeId, diffStatus, visibleNodeIds, onSelectNode, toggleExpand, onOpenDoc, lodCollapse])

  useEffect(() => { setNodes(rfNodes) }, [rfNodes, setNodes])
  useEffect(() => { setEdges(rfEdges) }, [rfEdges, setEdges])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEdgeEdit(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { getNodes, fitView } = useReactFlow()

  // Expose the flow-coords at the centre of the visible pane, read imperatively (no
  // re-render) from the store's live transform + pane size. Used to place new nodes.
  const storeApi = useStoreApi()
  useEffect(() => {
    if (!spawnCenterRef) return
    spawnCenterRef.current = () => {
      const { width, height, transform } = storeApi.getState()
      const [tx, ty, zoom] = transform
      return { x: (width / 2 - tx) / zoom, y: (height / 2 - ty) / zoom }
    }
    return () => { if (spawnCenterRef) spawnCenterRef.current = null }
  }, [spawnCenterRef, storeApi])

  // Box-select ("Select" mode): drag a marquee to grab several nodes, then drag the
  // group to reposition it or delete it together (with a warning).
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmDelMany, setConfirmDelMany] = useState(false)
  const [deletingMany, setDeletingMany] = useState(false)

  const handleSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    setSelectedIds(sel.map((n) => n.id))
  }, [])
  const handleSelectionDragStop = useCallback((_: React.MouseEvent, dragged: Node[]) => {
    onNodesMove?.(dragged.map((n) => ({ id: n.id, position_x: n.position.x, position_y: n.position.y })))
  }, [onNodesMove])
  const clearSelection = useCallback(() => {
    setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)))
    setSelectedIds([])
  }, [setNodes])

  // Whole ⇄ Grouped: unfold every area on this level in place, or fold everything back.
  // An "area" is a referenced map OR a drill-down container with children.
  const topAreas = useMemo(
    () => flow.nodes.filter((n) => n.linked_map_id || (DRILLABLE.has(n.kind) && (n.child_count ?? 0) > 0)),
    [flow.nodes],
  )
  const anyExpanded = expandedIds.size > 0
  const fitOnNextExpand = useRef(false)
  const toggleAll = useCallback(() => {
    fitOnNextExpand.current = true
    if (anyExpanded) { setExpandedIds(new Set()); return }
    setExpandedIds(new Set(topAreas.map((n) => n.id)))
    for (const n of topAreas) {
      fetchSub(n.linked_map_id
        ? { contentKey: `map:${n.linked_map_id}`, linkedMapId: n.linked_map_id, mapId: flow.map_id, nodeId: n.id }
        : { contentKey: `node:${flow.map_id}:${n.id}`, linkedMapId: null, mapId: flow.map_id, nodeId: n.id })
    }
  }, [anyExpanded, topAreas, fetchSub, flow.map_id])

  // Touch devices always pan on one-finger drag (no marquee) so the map is never stuck;
  // mouse/trackpad get the Figma model (drag = marquee-select in edit mode).
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const on = () => setIsTouch(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  // Swimlane view has computed positions (nodes aren't dragged), so drag just pans there.
  const marquee = canEdit && !isTouch && !swimlane

  // The minimap earns its place only when the map is bigger than the screen — otherwise it's
  // clutter with nothing to navigate. Recomputes on zoom / resize, not on every pan.
  const paneW = useStore((s) => s.width)
  const paneH = useStore((s) => s.height)
  const zoomLevel = useStore((s) => s.transform[2])
  const needsMinimap = useMemo(() => {
    const tops = nodes.filter((n) => !n.parentNode)
    if (tops.length < 2 || !paneW || !paneH) return false
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of tops) {
      const w = n.width ?? 200, h = n.height ?? 100
      minX = Math.min(minX, n.position.x); minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + w); maxY = Math.max(maxY, n.position.y + h)
    }
    return (maxX - minX) * zoomLevel > paneW + 24 || (maxY - minY) * zoomLevel > paneH + 24
  }, [nodes, paneW, paneH, zoomLevel])

  // Bound panning to the map's content (+ a margin) so you can't scroll off into infinite
  // empty space. Recomputes as nodes move / are added, so the reachable area always fits the map.
  const translateExtent = useMemo<[[number, number], [number, number]]>(() => {
    const tops = nodes.filter((n) => !n.parentNode)
    if (!tops.length) return [[-Infinity, -Infinity], [Infinity, Infinity]]
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of tops) {
      const w = n.width ?? 220, h = n.height ?? 120
      minX = Math.min(minX, n.position.x); minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + w); maxY = Math.max(maxY, n.position.y + h)
    }
    return [[minX - PAN_PAD, minY - PAN_PAD], [maxX + PAN_PAD, maxY + PAN_PAD]]
  }, [nodes])

  // The viewport ease smooths panning, but on ZOOM it eases the scale + zoom-to-cursor focal
  // point, which reads as laggy/slippery. So kill the ease whenever the zoom level changes
  // (wheel, pinch, buttons, fit) and restore it shortly after — zoom stays instant and locked
  // to the cursor, panning stays smooth.
  const prevZoom = useRef(zoomLevel)
  useEffect(() => {
    if (prevZoom.current === zoomLevel) return
    prevZoom.current = zoomLevel
    const vp = document.querySelector('.ph-canvas .react-flow__viewport')
    if (!vp) return
    vp.classList.add('ph-no-anim')
    const t = setTimeout(() => vp.classList.remove('ph-no-anim'), 120)
    return () => clearTimeout(t)
  }, [zoomLevel])

  // Re-fit the view each time we enter a new level (initial load, drill in, or
  // drill out). Keyed on the level id so dragging/adding within a level never
  // yanks the viewport. Double rAF lets the new nodes mount + measure first.
  const levelKey = flow.breadcrumb.length ? flow.breadcrumb[flow.breadcrumb.length - 1].id : 'root'
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => fitView(FIT_OPTIONS)) })
    return () => { cancelAnimationFrame(outer); if (inner) cancelAnimationFrame(inner) }
  }, [levelKey, swimlane, fitView])

  // Copy / paste with the keyboard — Ctrl on Windows/Linux, ⌘ on Mac. Copies the box
  // selection, or the single selected node if there's no box selection. Ignored while
  // typing in a field so it never clobbers normal text copy/paste.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const k = e.key.toLowerCase()
      if (k === 'c' && onCopyNodes) {
        const ids = selectedIds.length ? selectedIds : selectedNodeId ? [selectedNodeId] : []
        if (ids.length) { e.preventDefault(); onCopyNodes(ids) }
      } else if (k === 'v' && onPaste) {
        e.preventDefault(); onPaste()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, selectedNodeId, onCopyNodes, onPaste])

  // Only re-fit the viewport on a *bulk* unfold/fold (the Whole toggle). Expanding a
  // single area leaves the viewport where it is, so it grows in place instead of the
  // whole canvas appearing to jump.
  const expandKey = useMemo(() => Array.from(expandedIds).sort().join('|'), [expandedIds])
  const firstExpandFit = useRef(true)
  useEffect(() => {
    if (firstExpandFit.current) { firstExpandFit.current = false; return }
    if (!fitOnNextExpand.current) return
    fitOnNextExpand.current = false
    let inner = 0
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => fitView({ ...FIT_OPTIONS, duration: 350 })) })
    return () => { cancelAnimationFrame(outer); if (inner) cancelAnimationFrame(inner) }
  }, [expandKey, fitView])

  // Blue-dot interactions (swimlane): drag a dot → connect to an existing node (onConnect);
  // a plain click on a dot (no drag) → open the "add a connected next step" picker. We tell
  // them apart by whether a connection was made and how far the pointer moved.
  const connectStartRef = useRef<{ nodeId: string; handleId: string | null; x: number; y: number } | null>(null)
  const madeConnRef = useRef(false)
  const appendGuardRef = useRef(0) // timestamp — suppresses the node click that can follow a dot click
  const handleConnectStart = useCallback((e: any, params: { nodeId: string | null; handleId: string | null }) => {
    madeConnRef.current = false
    const p = e?.touches?.[0] ?? e
    connectStartRef.current = { nodeId: params.nodeId ?? '', handleId: params.handleId ?? null, x: p?.clientX ?? 0, y: p?.clientY ?? 0 }
  }, [])
  const handleConnectEnd = useCallback((e: any) => {
    const start = connectStartRef.current
    connectStartRef.current = null
    if (madeConnRef.current || !start || !swimlane || !onAppendFromNode) return
    const p = e?.changedTouches?.[0] ?? e
    if (Math.hypot((p?.clientX ?? 0) - start.x, (p?.clientY ?? 0) - start.y) > 6) return // a drag that missed a node, not a click
    const src = flow.nodes.find((n) => n.id === start.nodeId)
    if (!src) return
    appendGuardRef.current = Date.now()
    onAppendFromNode(start.nodeId, src.pool ?? null, src.department_id ?? null, start.handleId ?? undefined)
  }, [swimlane, onAppendFromNode, flow.nodes])

  // A tap on a drillable node (container / sub-process / linked map) goes *inside*
  // it; the small pencil (handled in the node) opens the edit panel instead. A tap
  // on a leaf node has nothing to enter, so it opens the edit panel.
  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (Date.now() - appendGuardRef.current < 350) return // a dot-click just opened the append picker
    if (node.id.includes('::')) {
      // A step shown inside an unfolded area. If it lives in another map (a reference),
      // open that map to edit it; a same-map drill-down child is view-only inline.
      const m = metaRef.current[node.id]
      if (m && m.mapId !== flow.map_id && onOpenMap) onOpenMap(m.mapId)
      return
    }
    const d = node.data as ProcessNodeData
    if (DRILLABLE.has(d.kind) || d.linkedMapName) onDrill(node.id)
    else onSelectNode(node.id)
  }, [onDrill, onSelectNode, onOpenMap, flow.map_id])
  const handleEdgeClick: EdgeMouseHandler = useCallback((evt, edge) => {
    if (!canEdit) return
    const conn = connById.get(edge.id)
    if (!conn) return
    evt.stopPropagation()
    setEdgeEdit({ conn, x: evt.clientX, y: evt.clientY, label: conn.label ?? '' })
  }, [canEdit, connById])

  const handleExport = useCallback(async () => {
    const all = getNodes()
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!all.length || !viewport) return
    try {
      const PAD = 0.12
      const bounds = getRectOfNodes(all)
      const width = Math.min(4096, Math.max(320, Math.round(bounds.width * (1 + PAD * 2))))
      const height = Math.min(4096, Math.max(320, Math.round(bounds.height * (1 + PAD * 2))))
      const [tx, ty, scale] = getTransformForBounds(bounds, width, height, 0.2, 2, PAD)
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(viewport, {
        backgroundColor: '#ffffff', width, height, pixelRatio: 2, cacheBust: true,
        style: { width: `${width}px`, height: `${height}px`, transform: `translate(${tx}px, ${ty}px) scale(${scale})` },
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = 'process-map.png'
      link.click()
    } catch {
      /* ignore */
    }
  }, [getNodes])

  // Let the page's ⋯ menu trigger PNG export (the button no longer sits on the canvas).
  useEffect(() => {
    if (!exportPngRef) return
    exportPngRef.current = handleExport
    return () => { if (exportPngRef) exportPngRef.current = null }
  }, [exportPngRef, handleExport])
  const handleDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id.includes('::')) return
      if (swimlane) {
        // Vertical is locked to the lane; horizontal is free. Which lane did it land in (by the
        // node's vertical centre)? Different department → reassign (keeping the new x). Same lane
        // → just store the new x (spacing). Dropped outside any lane → snap back.
        const cy = node.position.y + 48 // half of the fixed swimlane node height (96)
        const newX = Math.max(CONTENT_X, Math.round(node.position.x))
        const band = laneBandsRef.current.find((b) => cy >= b.yTop && cy < b.yBottom)
        const cur = flow.nodes.find((n) => n.id === node.id)
        if (!band || !cur) { setNodes(rfNodes); return }
        if (band.pool !== (cur.pool ?? null) || band.deptId !== (cur.department_id ?? null)) {
          onReassignLane?.(node.id, band.pool, band.deptId, newX)
        } else {
          onNodeDragStop(node.id, newX, node.position.y) // same lane → save horizontal position
        }
        return
      }
      onNodeDragStop(node.id, node.position.x, node.position.y)
    },
    [swimlane, flow.nodes, onReassignLane, rfNodes, setNodes, onNodeDragStop],
  )
  const handleConnect = useCallback(
    (c: Connection) => {
      madeConnRef.current = true // a real connection was drawn — not a dot click
      if (!c.source || !c.target || c.source === c.target) return
      // Drawing FROM a decision asks Yes/No in a pop-up (created there); anything else is a
      // plain sequence flow, created immediately. Either way we remember the exact dot dragged from.
      const side = c.sourceHandle ?? undefined
      const src = flow.nodes.find((n) => n.id === c.source)
      if (src?.kind === 'decision' && onDecisionConnect) { onDecisionConnect(c.source, c.target, side); return }
      onConnect(c.source, c.target, 'none', side)
    },
    [onConnect, onDecisionConnect, flow.nodes],
  )

  const edgeFromDecision = edgeEdit ? kindById.get(edgeEdit.conn.source_node_id) === 'decision' : false

  return (
    <>
    <style>{PH_CANVAS_CSS}</style>
    <ReactFlow
      className="ph-canvas"
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={canEdit}
      nodesConnectable={canEdit}
      elementsSelectable
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onNodeDragStop={handleDragStop}
      onSelectionChange={handleSelectionChange}
      onSelectionDragStop={handleSelectionDragStop}
      onConnect={handleConnect}
      onConnectStart={handleConnectStart}
      onConnectEnd={handleConnectEnd}
      onPaneClick={() => setEdgeEdit(null)}
      fitView
      fitViewOptions={FIT_OPTIONS}
      minZoom={0.2}
      maxZoom={2}
      translateExtent={translateExtent}
      proOptions={{ hideAttribution: true }}
      // Figma-style navigation on mouse/trackpad: drag empty space = marquee-select (edit
      // only), wheel / two-finger scroll = pan, ⌘/Ctrl+scroll or trackpad-pinch = zoom, and
      // hold Space (or middle/right mouse) to pan while the marquee is on. On touch, one-finger
      // drag always pans and pinch zooms, so the map is never stuck.
      selectionOnDrag={marquee}
      selectionMode={SelectionMode.Partial}
      panOnDrag={marquee ? [1, 2] : true}
      panOnScroll={!isTouch}
      zoomOnScroll={false}
      zoomActivationKeyCode={['Meta', 'Control']}
      panActivationKeyCode="Space"
      deleteKeyCode={null}
      zoomOnPinch
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E2E8F0" />
      {/* fitViewOptions must be repeated here — the Controls fit button uses its own,
          not the flow-level fitViewOptions (else it zooms in past 100%). */}
      <Controls showInteractive={false} fitViewOptions={FIT_OPTIONS} />
      {/* Faint scrollbars — the visible pan affordance for a mouse user in the Figma model. */}
      {!isTouch && <CanvasScrollbars nodes={nodes} />}
      {/* Minimap floats bottom-right; hidden on the narrowest screens so it can't
          overlap the zoom / add controls, and toggleable when it's in the way. */}
      {needsMinimap && (
        <MiniMap nodeColor={() => '#2563EB'} maskColor="rgba(15,23,42,0.05)" pannable zoomable
          className="!hidden sm:!block" style={{ width: 180, height: 120 }} />
      )}

      {/* Selection action bar — appears once 2+ nodes are box-selected (edit only). Sits
          bottom-centre (controls are bottom-left, minimap bottom-right) so it never hides
          behind the top-right toolbar; raised z-index keeps it above any panel overlap. */}
      {canEdit && selectedIds.length >= 2 && (
        <Panel position="bottom-center" style={{ zIndex: 20 }}>
          <div className="flex items-center gap-2 rounded-[10px] bg-[#0F172A] text-white shadow-lg px-3 py-1.5 text-[12px]">
            <span className="font-semibold">{selectedIds.length} selected</span>
            <span className="text-white/40">·</span>
            <span className="text-white/70">drag to move</span>
            {onCopyNodes && (
              <button onClick={() => onCopyNodes(selectedIds)}
                className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-[6px] bg-white/10 hover:bg-white/20 font-semibold transition-colors">
                <Copy size={12} /> Copy
              </button>
            )}
            {canEdit && onDeleteNodes && (
              <button onClick={() => setConfirmDelMany(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] bg-[#DC2626] hover:bg-[#B91C1C] font-semibold transition-colors">
                <Trash2 size={12} /> Delete
              </button>
            )}
            <button onClick={clearSelection} aria-label="Clear selection"
              className="inline-flex items-center px-1.5 py-1 rounded-[6px] hover:bg-white/10 text-white/80"><X size={13} /></button>
          </div>
        </Panel>
      )}

      {/* The canvas keeps a single primary — Add step. "Whole/Grouped" only appears when this
          level actually has areas to unfold in place. Auto-arrange, PNG export, the minimap and
          multi-select all moved off the canvas (⋯ menu, or automatic) so the map is the hero. */}
      <Panel position="top-right">
        <div className="flex items-center gap-1.5">
          {!swimlane && topAreas.length > 0 && (
            <button onClick={toggleAll} title={anyExpanded ? 'Collapse all areas' : 'Unfold all areas in place'} aria-pressed={anyExpanded}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-[8px] border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1 ${anyExpanded ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]' : 'bg-white border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] hover:border-[#CBD5E1]'}`}>
              {anyExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />} <span className="hidden md:inline">{anyExpanded ? 'Grouped' : 'Whole'}</span>
            </button>
          )}
          {topRightExtra}
        </div>
      </Panel>

      {/* Connection editor popover */}
      {edgeEdit && (
        <div
          className="fixed z-[80] w-60 bg-white border border-[#E2E8F0] rounded-[10px] shadow-[0_8px_28px_rgba(0,0,0,0.16)] p-3"
          style={{ left: Math.min(edgeEdit.x, window.innerWidth - 260), top: Math.min(edgeEdit.y, window.innerHeight - 210) }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-[#0F172A]">Connection</span>
            <button onClick={() => setEdgeEdit(null)} aria-label="Close" className="text-[#94A3B8] hover:text-[#0F172A]"><X size={14} /></button>
          </div>
          <label className="block text-[11px] font-medium text-[#475569] mb-1">Label</label>
          <input
            value={edgeEdit.label}
            onChange={(e) => setEdgeEdit({ ...edgeEdit, label: e.target.value })}
            placeholder="e.g. Approved"
            className="w-full px-2.5 py-1.5 text-[13px] rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none mb-2"
          />
          {edgeFromDecision && (
            <div className="mb-2">
              <label className="block text-[11px] font-medium text-[#475569] mb-1">Branch</label>
              <StyledSelect
                value={edgeEdit.conn.condition_kind}
                onChange={(v) => {
                  const cond = v as ProcessConditionKind
                  // Keep the label in step with the branch — unless the user typed a custom one.
                  const defaultFor = (k: ProcessConditionKind) => (k === 'yes' ? 'Yes' : k === 'no' ? 'No' : '')
                  const wasDefault = !edgeEdit.label.trim() || edgeEdit.label.trim() === defaultFor(edgeEdit.conn.condition_kind)
                  setEdgeEdit({
                    ...edgeEdit,
                    label: wasDefault ? defaultFor(cond) : edgeEdit.label,
                    conn: { ...edgeEdit.conn, condition_kind: cond },
                  })
                }}
                options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'none', label: 'No condition' }]}
                size="sm"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onUpdateConnection?.(edgeEdit.conn.id, { label: edgeEdit.label.trim(), condition_kind: edgeEdit.conn.condition_kind })
                setEdgeEdit(null)
              }}
              className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-[13px] font-semibold rounded-[8px] bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
            >
              Save
            </button>
            <button
              onClick={() => { onDeleteConnection?.(edgeEdit.conn.id); setEdgeEdit(null) }}
              aria-label="Delete connection"
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-[8px] border border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2]"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </ReactFlow>

    <ConfirmDialog
      open={confirmDelMany}
      danger
      title={`Delete ${selectedIds.length} step${selectedIds.length !== 1 ? 's' : ''}?`}
      message="This permanently deletes the selected steps and anything nested inside them. This cannot be undone."
      confirmLabel="Delete"
      loading={deletingMany}
      onConfirm={async () => {
        setDeletingMany(true)
        try { await onDeleteNodes?.(selectedIds) }
        finally { setDeletingMany(false); setConfirmDelMany(false); setSelectedIds([]) }
      }}
      onCancel={() => { if (!deletingMany) setConfirmDelMany(false) }}
    />
    </>
  )
}

// Faint Figma-style scrollbars. In the Figma nav model a left-drag makes a selection box, so
// these are the one *visible* way for a mouse user to pan — especially horizontally, which
// matters because process maps grow left-to-right. Dragging a thumb pans the viewport. They
// auto-hide when the whole map already fits, and inset to clear the zoom controls / minimap.
function CanvasScrollbars({ nodes }: { nodes: Node[] }) {
  const { setViewport } = useReactFlow()
  const tx = useStore((s) => s.transform[0])
  const ty = useStore((s) => s.transform[1])
  const zoom = useStore((s) => s.transform[2])
  const width = useStore((s) => s.width)
  const height = useStore((s) => s.height)
  const drag = useRef<{ axis: 'h' | 'v'; startX: number; startY: number; tx: number; ty: number } | null>(null)

  // The bars are a 12px-thick strip at the extreme edge; the zoom controls and minimap sit ~15px
  // inside, so they never collide. Only a small corner gap (VB/HR) keeps the two bars from crossing.
  const HL = 8, HR = 16, VT = 8, VB = 16

  const geo = useMemo(() => {
    const tops = nodes.filter((n) => !n.parentNode)
    if (!tops.length || !width || !height) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of tops) {
      const w = n.width ?? 200, h = n.height ?? 100
      minX = Math.min(minX, n.position.x); minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + w); maxY = Math.max(maxY, n.position.y + h)
    }
    const exL = minX - PAN_PAD, exT = minY - PAN_PAD
    const exW = (maxX - minX) + PAN_PAD * 2, exH = (maxY - minY) + PAN_PAD * 2
    if (exW <= 0 || exH <= 0) return null
    const visL = -tx / zoom, visT = -ty / zoom
    const visW = width / zoom, visH = height / zoom
    return {
      exW, exH,
      // Extent = content + the same margin panning is bounded to, so a bar shows exactly when that
      // axis can scroll, and the thumb maps 1:1 to the real range. Visibility depends only on zoom
      // (not pan position), so a bar never blinks out mid-scroll.
      showH: exW * zoom > width + 1,
      showV: exH * zoom > height + 1,
      hLeft: (visL - exL) / exW, hSize: visW / exW,
      vTop: (visT - exT) / exH, vSize: visH / exH,
    }
  }, [nodes, tx, ty, zoom, width, height])

  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current, g = geo
    if (!d || !g) return
    if (d.axis === 'h') {
      const trackW = width - HL - HR
      const dxPx = e.clientX - d.startX
      setViewport({ x: d.tx - (dxPx / trackW) * g.exW * zoom, y: d.ty, zoom })
    } else {
      const trackH = height - VT - VB
      const dyPx = e.clientY - d.startY
      setViewport({ x: d.tx, y: d.ty - (dyPx / trackH) * g.exH * zoom, zoom })
    }
  }, [geo, width, height, zoom, setViewport, HL, HR, VT, VB])

  const onUp = useCallback(() => {
    drag.current = null
    // Re-enable the smooth ease once the thumb is released.
    document.querySelector('.ph-canvas .react-flow__viewport')?.classList.remove('ph-no-anim')
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }, [onMove])

  const onDown = useCallback((axis: 'h' | 'v', e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    drag.current = { axis, startX: e.clientX, startY: e.clientY, tx, ty }
    // Thumb-drag should track the pointer 1:1 — turn the viewport ease off for the drag.
    document.querySelector('.ph-canvas .react-flow__viewport')?.classList.add('ph-no-anim')
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [tx, ty, onMove, onUp])

  if (!geo || (!geo.showH && !geo.showV)) return null
  const hLeft = Math.max(0, Math.min(geo.hLeft, 1 - geo.hSize))
  const vTop = Math.max(0, Math.min(geo.vTop, 1 - geo.vSize))
  return (
    <>
      {geo.showH && (
        <div className="absolute z-10 pointer-events-none" style={{ left: HL, right: HR, bottom: 3, height: 9 }}>
          <div onPointerDown={(e) => onDown('h', e)} role="scrollbar" aria-orientation="horizontal"
            className="absolute top-0 h-full rounded-full bg-[#94A3B8]/40 hover:bg-[#64748B]/70 pointer-events-auto cursor-grab active:cursor-grabbing transition-colors"
            style={{ left: `${hLeft * 100}%`, width: `${geo.hSize * 100}%`, minWidth: 28 }} />
        </div>
      )}
      {geo.showV && (
        <div className="absolute z-10 pointer-events-none" style={{ right: 3, top: VT, bottom: VB, width: 9 }}>
          <div onPointerDown={(e) => onDown('v', e)} role="scrollbar" aria-orientation="vertical"
            className="absolute left-0 w-full rounded-full bg-[#94A3B8]/40 hover:bg-[#64748B]/70 pointer-events-auto cursor-grab active:cursor-grabbing transition-colors"
            style={{ top: `${vTop * 100}%`, height: `${geo.vSize * 100}%`, minHeight: 28 }} />
        </div>
      )}
    </>
  )
}

export default function ProcessCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  )
}
