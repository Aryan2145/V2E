'use client'

import { useEffect, useCallback, useMemo, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  getRectOfNodes,
  getTransformForBounds,
  ReactFlowProvider,
  BackgroundVariant,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Download, LayoutGrid, Trash2, X } from 'lucide-react'
import { nodeTypes, type ProcessNodeData } from './nodes'
import StyledSelect from '@/components/ui/StyledSelect'
import type { FlowLevel, ProcessConditionKind, ProcessConnection, DiffChangeKind } from '@/lib/api/process-hierarchy'

interface Props {
  flow: FlowLevel
  canEdit: boolean
  selectedNodeId: string | null
  visibleNodeIds: Set<string> | null // null = show all
  diffStatus?: Record<string, DiffChangeKind> | null // when comparing versions
  onSelectNode: (nodeId: string) => void
  onDrill: (nodeId: string) => void
  onConnect: (source: string, target: string, condition: ProcessConditionKind) => void
  onNodeDragStop: (nodeId: string, x: number, y: number) => void
  onAutoLayout?: () => void
  onUpdateConnection?: (id: string, dto: { label?: string; condition_kind?: ProcessConditionKind }) => void
  onDeleteConnection?: (id: string) => void
}

const DRILLABLE = new Set(['container', 'subprocess'])

function Inner({
  flow, canEdit, selectedNodeId, visibleNodeIds, diffStatus,
  onSelectNode, onDrill, onConnect, onNodeDragStop, onAutoLayout, onUpdateConnection, onDeleteConnection,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [edgeEdit, setEdgeEdit] = useState<{ conn: ProcessConnection; x: number; y: number; label: string } | null>(null)

  const connById = useMemo(() => new Map(flow.connections.map((c) => [c.id, c])), [flow.connections])
  const kindById = useMemo(() => new Map(flow.nodes.map((n) => [n.id, n.kind])), [flow.nodes])

  const rfNodes = useMemo<Node<ProcessNodeData>[]>(() => {
    return flow.nodes
      .filter((n) => !visibleNodeIds || visibleNodeIds.has(n.id))
      .map((n) => {
        const canOpen = DRILLABLE.has(n.kind) || !!n.linked_map_name
        return {
          id: n.id,
          type: 'process',
          position: { x: n.position_x, y: n.position_y },
          draggable: canEdit,
          data: {
            name: n.name,
            kind: n.kind,
            status: n.status,
            childCount: n.child_count ?? 0,
            drillable: DRILLABLE.has(n.kind),
            selected: n.id === selectedNodeId,
            diff: diffStatus?.[n.id],
            linkedMapName: n.linked_map_name ?? null,
            onOpen: canOpen ? () => onDrill(n.id) : undefined,
          },
        }
      })
  }, [flow.nodes, visibleNodeIds, canEdit, selectedNodeId, diffStatus, onDrill])

  const rfEdges = useMemo<Edge[]>(() => {
    const visible = new Set(rfNodes.map((n) => n.id))
    const outputsBy = new Map(flow.nodes.map((n) => [n.id, n.outputs ?? []]))
    const inputIdsBy = new Map(flow.nodes.map((n) => [n.id, new Set((n.inputs ?? []).map((a) => a.id))]))
    return flow.connections
      .filter((c) => visible.has(c.source_node_id) && visible.has(c.target_node_id))
      .map((c) => {
        const fromDecision = kindById.get(c.source_node_id) === 'decision'
        const targetInputs = inputIdsBy.get(c.target_node_id) ?? new Set<string>()
        const chips = (outputsBy.get(c.source_node_id) ?? []).filter((a) => targetInputs.has(a.id)).map((a) => a.name)
        const condLabel = c.label || (c.condition_kind !== 'none' ? c.condition_kind.toUpperCase() : '')
        const label = [condLabel, chips.length ? `📄 ${chips.join(', ')}` : ''].filter(Boolean).join('  ·  ')
        return {
          id: c.id,
          source: c.source_node_id,
          target: c.target_node_id,
          sourceHandle: fromDecision ? (c.condition_kind === 'no' ? 'no' : 'yes') : undefined,
          label: label || undefined,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' },
          style: { stroke: '#64748B', strokeWidth: 1.5 },
          labelStyle: { fill: '#475569', fontSize: 11, fontWeight: 600 },
          labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
        } as Edge
      })
  }, [flow.connections, flow.nodes, rfNodes, kindById])

  useEffect(() => { setNodes(rfNodes) }, [rfNodes, setNodes])
  useEffect(() => { setEdges(rfEdges) }, [rfEdges, setEdges])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEdgeEdit(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { getNodes } = useReactFlow()
  const [exporting, setExporting] = useState(false)

  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => onSelectNode(node.id), [onSelectNode])
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const d = node.data as ProcessNodeData
      if (DRILLABLE.has(d.kind) || d.linkedMapName) onDrill(node.id)
    },
    [onDrill],
  )
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
    setExporting(true)
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
    } finally {
      setExporting(false)
    }
  }, [getNodes])
  const handleDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => onNodeDragStop(node.id, node.position.x, node.position.y),
    [onNodeDragStop],
  )
  const handleConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return
      const condition: ProcessConditionKind = c.sourceHandle === 'no' ? 'no' : c.sourceHandle === 'yes' ? 'yes' : 'none'
      onConnect(c.source, c.target, condition)
    },
    [onConnect],
  )

  const edgeFromDecision = edgeEdit ? kindById.get(edgeEdit.conn.source_node_id) === 'decision' : false

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      nodesDraggable={canEdit}
      nodesConnectable={canEdit}
      elementsSelectable
      onNodeClick={handleNodeClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      onEdgeClick={handleEdgeClick}
      onNodeDragStop={handleDragStop}
      onConnect={handleConnect}
      onPaneClick={() => setEdgeEdit(null)}
      fitView
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      panOnDrag
      zoomOnScroll={false}
      preventScrolling={false}
      zoomOnPinch
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E2E8F0" />
      <Controls showInteractive={false} />
      <MiniMap nodeColor={() => '#2563EB'} maskColor="rgba(15,23,42,0.05)" pannable zoomable />

      {/* Status legend */}
      <Panel position="bottom-center">
        <div className="flex items-center gap-3 rounded-full bg-white/95 border border-[#E2E8F0] shadow-sm px-3 py-1 text-[11px] text-[#475569]">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#94A3B8]" /> Draft</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#D97706]" /> In review</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#16A34A]" /> Final</span>
        </div>
      </Panel>

      <Panel position="top-right">
        <div className="flex items-center gap-1.5">
          {canEdit && onAutoLayout && (
            <button onClick={onAutoLayout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-[8px] bg-white border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] hover:border-[#CBD5E1] shadow-sm">
              <LayoutGrid size={13} /> Auto-arrange
            </button>
          )}
          <button onClick={handleExport} disabled={exporting}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-[8px] bg-white border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] hover:border-[#CBD5E1] shadow-sm disabled:opacity-60">
            <Download size={13} /> {exporting ? 'Exporting…' : 'PNG'}
          </button>
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
                onChange={(v) => setEdgeEdit({ ...edgeEdit, conn: { ...edgeEdit.conn, condition_kind: v as ProcessConditionKind } })}
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
  )
}

export default function ProcessCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  )
}
