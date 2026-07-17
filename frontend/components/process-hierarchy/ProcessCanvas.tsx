'use client'

import { useEffect, useCallback, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  BackgroundVariant,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeMouseHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { nodeTypes, type ProcessNodeData } from './nodes'
import type { FlowLevel, ProcessConditionKind, DiffChangeKind } from '@/lib/api/process-hierarchy'

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
}

const DRILLABLE = new Set(['container', 'subprocess'])

function Inner({ flow, canEdit, selectedNodeId, visibleNodeIds, diffStatus, onSelectNode, onDrill, onConnect, onNodeDragStop }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const rfNodes = useMemo<Node<ProcessNodeData>[]>(() => {
    return flow.nodes
      .filter((n) => !visibleNodeIds || visibleNodeIds.has(n.id))
      .map((n) => ({
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
        },
      }))
  }, [flow.nodes, visibleNodeIds, canEdit, selectedNodeId, diffStatus])

  const rfEdges = useMemo<Edge[]>(() => {
    const visible = new Set(rfNodes.map((n) => n.id))
    const kindById = new Map(flow.nodes.map((n) => [n.id, n.kind]))
    // Per-node input/output artifact sets for deriving "the document that flows here".
    const outputsBy = new Map(flow.nodes.map((n) => [n.id, n.outputs ?? []]))
    const inputIdsBy = new Map(flow.nodes.map((n) => [n.id, new Set((n.inputs ?? []).map((a) => a.id))]))
    return flow.connections
      .filter((c) => visible.has(c.source_node_id) && visible.has(c.target_node_id))
      .map((c) => {
        const fromDecision = kindById.get(c.source_node_id) === 'decision'
        // Artifact chip: an output of the source that is also an input of the target.
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
  }, [flow.connections, flow.nodes, rfNodes])

  useEffect(() => { setNodes(rfNodes) }, [rfNodes, setNodes])
  useEffect(() => { setEdges(rfEdges) }, [rfEdges, setEdges])

  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => onSelectNode(node.id), [onSelectNode])
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (DRILLABLE.has((node.data as ProcessNodeData).kind)) onDrill(node.id)
    },
    [onDrill],
  )
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
      onNodeDragStop={handleDragStop}
      onConnect={handleConnect}
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
