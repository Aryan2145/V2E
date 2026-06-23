'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Maximize2, Users, Zap } from 'lucide-react'
import { computeNodeColors } from '@/lib/org-chart-colors'
import { levelColors } from '@/lib/role-levels'
import {
  buildEmployeeForest,
  computeForestLayout,
  groupFreeRadicalsByDept,
  layoutFreeRadicals,
  NODE_W,
  NODE_H,
} from '@/lib/employee-tree'
import EmployeeNode, { type EmployeeNodeData } from './EmployeeNode'
import type { Department, EmployeeProfile, EmployeeStatus } from '@/lib/types'

interface Props {
  employees: EmployeeProfile[]
  departments: Department[]
}

const statusDot: Record<EmployeeStatus, string> = {
  active: 'bg-[#16A34A]',
  inactive: 'bg-[#DC2626]',
  on_leave: 'bg-[#CA8A04]',
}

// Don't let the auto-fit zoom out past this — below it node text is unreadable,
// so we'd rather start readable (and let the user pan) than show an unusable overview.
const FIT_MIN_ZOOM = 0.65

function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'
}

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return desktop
}

// ─── Free-radical cluster label (a tiny reactflow node) ─────────────────────────

function FrLabelNode({ data }: { data: { label: string; color: string } }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-[999px] bg-white border border-[#E2E8F0] px-2.5 py-1 shadow-sm">
      <Zap size={11} className="text-[#CA8A04]" />
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
      <span className="text-[11px] font-semibold text-[#475569]">Unlinked · {data.label}</span>
    </div>
  )
}

const nodeTypes = { employeeNode: EmployeeNode, frLabel: FrLabelNode }

// ─── Canvas (reactflow) ─────────────────────────────────────────────────────────

function Flow({
  nodes,
  edges,
  fitRef,
}: {
  nodes: Node[]
  edges: Edge[]
  fitRef: { current: (() => void) | null }
}) {
  const router = useRouter()
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges)
  const [interacted, setInteracted] = useState(false)
  const { fitView } = useReactFlow()

  // Expose Fit to the toolbar button rendered outside the provider.
  // This is the explicit "show me everything" overview, so it's allowed to
  // zoom out past FIT_MIN_ZOOM (unlike the readable auto-fit on load).
  useEffect(() => {
    fitRef.current = () => fitView({ padding: 0.2, duration: 300, maxZoom: 1 })
    return () => {
      fitRef.current = null
    }
  }, [fitView, fitRef])

  // Bound panning to the content (plus margin) so it can't scroll into infinity.
  const translateExtent = useMemo<[[number, number], [number, number]]>(() => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    nodes.forEach((n) => {
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + NODE_W)
      maxY = Math.max(maxY, n.position.y + NODE_H)
    })
    if (!Number.isFinite(minX)) return [[-500, -500], [500, 500]]
    const PAD_X = 320
    const PAD_Y = 240
    return [
      [minX - PAD_X, minY - PAD_Y],
      [maxX + PAD_X, maxY + PAD_Y],
    ]
  }, [nodes])

  useEffect(() => {
    setRfNodes(nodes)
    setRfEdges(edges)
    // Refit after the data changes (e.g. filter applied).
    const t = setTimeout(
      () => fitView({ padding: 0.2, duration: 300, minZoom: FIT_MIN_ZOOM, maxZoom: 1 }),
      50,
    )
    return () => clearTimeout(t)
  }, [nodes, edges, setRfNodes, setRfEdges, fitView])

  const onNodeClick: NodeMouseHandler = (_e, node) => {
    const id = (node.data as { empId?: string })?.empId
    if (id) router.push(`/settings/organization/employees/${id}`)
  }

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onMoveStart={() => setInteracted(true)}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      panOnDrag
      zoomOnScroll={false}
      preventScrolling={false}
      zoomOnPinch
      translateExtent={translateExtent}
      minZoom={0.2}
      maxZoom={2.5}
      fitView
      fitViewOptions={{ padding: 0.2, minZoom: FIT_MIN_ZOOM, maxZoom: 1 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E2E8F0" />
      <Panel position="bottom-center">
        <div
          className={`pointer-events-none select-none rounded-[999px] border border-[#E2E8F0] bg-white/85 px-3 py-1 text-[11px] font-medium text-[#94A3B8] shadow-sm backdrop-blur transition-opacity duration-500 ${
            interacted ? 'opacity-0' : 'opacity-100'
          }`}
        >
          Scroll to move the page · drag to explore the chart
        </div>
      </Panel>
      <Controls showInteractive={false} />
      <MiniMap nodeColor={() => '#2563EB'} maskColor="rgba(15,23,42,0.05)" pannable zoomable />
    </ReactFlow>
  )
}

// ─── Mobile card tree ───────────────────────────────────────────────────────────

function EmpCard({
  emp,
  color,
  onOpen,
  freeRadical,
}: {
  emp: EmployeeProfile
  color: string
  onOpen: (id: string) => void
  freeRadical?: boolean
}) {
  const name = emp.user?.name ?? 'Unknown'
  return (
    <button
      type="button"
      onClick={() => onOpen(emp.id)}
      style={{ borderLeft: `4px solid ${color}` }}
      className={`w-full flex items-center gap-2.5 bg-white rounded-[10px] border px-3 py-2.5 text-left hover:shadow-sm transition-shadow ${
        freeRadical ? 'border-dashed border-[#CBD5E1]' : 'border-[#E2E8F0]'
      }`}
    >
      <span
        className="w-9 h-9 shrink-0 rounded-full inline-flex items-center justify-center text-[11px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {initials(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[emp.status]}`} />
          <span className="block text-sm font-semibold text-[#0F172A] truncate">{name}</span>
        </span>
        <span className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-[#64748B] truncate">{emp.role?.title ?? 'No role'}</span>
          {emp.role?.level && (
            <span
              className={`inline-flex items-center rounded-[999px] px-1.5 py-px text-[10px] font-semibold capitalize shrink-0 ${levelColors[emp.role.level]}`}
            >
              {emp.role.level}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

function MobileBranch({
  emp,
  forest,
  colorFor,
  onOpen,
  depth,
}: {
  emp: EmployeeProfile
  forest: ReturnType<typeof buildEmployeeForest>
  colorFor: (deptId: string) => string
  onOpen: (id: string) => void
  depth: number
}) {
  const kids = forest.childrenOf.get(emp.user_id) ?? []
  return (
    <div>
      <EmpCard emp={emp} color={colorFor(emp.department_id)} onOpen={onOpen} />
      {kids.length > 0 && (
        <div className="ml-4 mt-2 pl-3 border-l border-[#E2E8F0] flex flex-col gap-2">
          {kids.map((k) => (
            <MobileBranch
              key={k.id}
              emp={k}
              forest={forest}
              colorFor={colorFor}
              onOpen={onOpen}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────────

export default function EmployeeTreeView({ employees, departments }: Props) {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const fitRef = useRef<(() => void) | null>(null)

  const colors = useMemo(() => computeNodeColors(departments), [departments])
  const colorFor = (deptId: string) => colors[deptId]?.base ?? '#94A3B8'

  const forest = useMemo(() => buildEmployeeForest(employees), [employees])

  // Departments present in the current view, for the legend.
  const legend = useMemo(() => {
    const present = new Set(employees.map((e) => e.department_id))
    return departments.filter((d) => present.has(d.id))
  }, [employees, departments])

  const { nodes, edges } = useMemo(() => {
    const { pos, width, height } = computeForestLayout(forest)
    const clusters = groupFreeRadicalsByDept(forest.freeRadicals, departments)
    const { pos: frPos, labels } = layoutFreeRadicals(
      clusters,
      height,
      Math.max(width, 4 * 232),
    )

    const empById = new Map(employees.map((e) => [e.id, e]))
    const toData = (emp: EmployeeProfile, freeRadical: boolean): EmployeeNodeData & { empId: string } => ({
      empId: emp.id,
      name: emp.user?.name ?? 'Unknown',
      roleTitle: emp.role?.title,
      level: emp.role?.level,
      status: emp.status,
      color: colorFor(emp.department_id),
      freeRadical,
    })

    const ns: Node[] = []
    for (const [id, p] of Object.entries(pos)) {
      const emp = empById.get(id)
      if (emp) ns.push({ id, type: 'employeeNode', position: p, data: toData(emp, false), draggable: false })
    }
    for (const [id, p] of Object.entries(frPos)) {
      const emp = empById.get(id)
      if (emp) ns.push({ id, type: 'employeeNode', position: p, data: toData(emp, true), draggable: false })
    }
    labels.forEach((l, i) => {
      ns.push({
        id: `frlabel-${i}`,
        type: 'frLabel',
        position: { x: l.x, y: l.y },
        data: { label: l.dept?.name ?? 'No department', color: l.dept ? colorFor(l.dept.id) : '#94A3B8' },
        draggable: false,
        selectable: false,
      })
    })

    const es: Edge[] = []
    forest.childrenOf.forEach((kids, mgrUserId) => {
      const mgr = forest.byUser.get(mgrUserId)
      if (!mgr) return
      kids.forEach((child) => {
        es.push({
          id: `e-${mgr.id}-${child.id}`,
          source: mgr.id,
          target: child.id,
          type: 'smoothstep',
          style: { stroke: colorFor(child.department_id), strokeWidth: 1.5, opacity: 0.5 },
        })
      })
    })
    return { nodes: ns, edges: es }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forest, employees, departments])

  const onOpen = (id: string) => router.push(`/settings/organization/employees/${id}`)

  if (employees.length === 0) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] flex flex-col items-center justify-center py-16 text-center">
        <Users size={26} className="text-[#CBD5E1] mb-2" />
        <p className="text-sm text-[#94A3B8]">No employees to chart.</p>
      </div>
    )
  }

  const freeRadicalClusters = groupFreeRadicalsByDept(forest.freeRadicals, departments)

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#475569]">
        <span className="font-semibold text-[#64748B]">Departments:</span>
        {legend.map((d) => (
          <span key={d.id} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorFor(d.id) }} />
            {d.name}
          </span>
        ))}
        {forest.freeRadicals.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[#94A3B8]">
            <Zap size={12} className="text-[#CA8A04]" /> unlinked = no manager &amp; no reports
          </span>
        )}
        {isDesktop && (
          <span className="ml-auto hidden items-center gap-3 md:inline-flex">
            <span className="text-[#94A3B8]">Drag to pan · Ctrl/⌘ + scroll or pinch to zoom</span>
            <button
              type="button"
              onClick={() => fitRef.current?.()}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
            >
              <Maximize2 size={12} /> Fit
            </button>
          </span>
        )}
      </div>

      {isDesktop ? (
        <div
          className="rounded-[12px] border border-[#E2E8F0] overflow-hidden bg-[#FAFBFC]"
          style={{ height: 640 }}
        >
          <ReactFlowProvider>
            <Flow nodes={nodes} edges={edges} fitRef={fitRef} />
          </ReactFlowProvider>
        </div>
      ) : (
        <div className="space-y-5">
          {forest.connectedRoots.map((root) => (
            <div key={root.id} className="bg-[#FAFBFC] border border-[#E2E8F0] rounded-[12px] p-3">
              <MobileBranch
                emp={root}
                forest={forest}
                colorFor={colorFor}
                onOpen={onOpen}
                depth={0}
              />
            </div>
          ))}

          {freeRadicalClusters.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-[#64748B]">
                <Zap size={13} className="text-[#CA8A04]" /> Free radicals (no manager &amp; no reports)
              </div>
              <div className="space-y-4">
                {freeRadicalClusters.map((c) => (
                  <div key={c.dept?.id ?? 'none'}>
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs text-[#475569]">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: c.dept ? colorFor(c.dept.id) : '#94A3B8' }}
                      />
                      {c.dept?.name ?? 'No department'}
                    </div>
                    <div className="flex flex-col gap-2">
                      {c.people.map((e) => (
                        <EmpCard
                          key={e.id}
                          emp={e}
                          color={colorFor(e.department_id)}
                          onOpen={onOpen}
                          freeRadical
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
