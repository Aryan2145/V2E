'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  PanOnScrollMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  BackgroundVariant,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAuth } from '@/lib/auth/context'
import { usePermissions } from '@/lib/auth/use-permissions'
import { getDepartments, updateDepartmentPosition } from '@/lib/api/departments'
import { getEmployees } from '@/lib/api/employees'
import { getUsers } from '@/lib/api/users'
import { computeTreeLayout } from '@/lib/org-chart-layout'
import { computeNodeColors, type NodeColor } from '@/lib/org-chart-colors'
import DeptNode, { type DeptNodeData } from '@/components/org-chart/DeptNode'
import DeptInfoPanel from '@/components/org-chart/DeptInfoPanel'
import DeptFormDrawer, { type DeptFormTarget } from '@/components/org-chart/DeptFormDrawer'
import type { Department, EmployeeProfile, User } from '@/lib/types'
import { Download, Network, Plus, LayoutGrid, Search, Check } from 'lucide-react'

const nodeTypes = { deptNode: DeptNode }
const STRUCTURE_LEAF = 'settings.organization.structure'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildNodes(
  departments: Department[],
  colors: Record<string, NodeColor>,
  opts: { canEdit: boolean; highlightIds: Set<string>; onEdit: (d: Department) => void },
): Node<DeptNodeData>[] {
  return departments.map((dept) => ({
    id: dept.id,
    type: 'deptNode',
    position: { x: dept.position_x, y: dept.position_y },
    data: {
      name: dept.name,
      headName: dept.head_user?.name,
      teamCount: dept._count?.employee_profiles ?? 0,
      roleCount: dept._count?.roles ?? 0,
      canEdit: opts.canEdit,
      highlighted: opts.highlightIds.has(dept.id),
      onEdit: () => opts.onEdit(dept),
      colors: colors[dept.id],
    },
    draggable: opts.canEdit,
  }))
}

function buildEdges(departments: Department[], colors: Record<string, NodeColor>): Edge[] {
  const ids = new Set(departments.map((d) => d.id))
  return departments
    .filter((d) => d.parent_department_id && ids.has(d.parent_department_id))
    .map((d) => ({
      id: `e-${d.parent_department_id}-${d.id}`,
      source: d.parent_department_id!,
      target: d.id,
      style: { stroke: colors[d.id]?.base ?? '#CBD5E1', strokeWidth: 2, opacity: 0.55 },
      type: 'smoothstep',
    }))
}

// ─── Export helper ─────────────────────────────────────────────────────────────

function exportPng() {
  const el = document.querySelector('.react-flow') as HTMLElement | null
  if (!el) return
  import('html2canvas').then(({ default: html2canvas }) => {
    html2canvas(el, { backgroundColor: '#ffffff', useCORS: true }).then((canvas) => {
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = 'department-structure.png'
      link.click()
    })
  })
}

// ─── Inner chart (must be inside ReactFlowProvider) ───────────────────────────

interface InnerProps {
  departments: Department[]
  colorMap: Record<string, NodeColor>
  canEdit: boolean
  orgId: string
  onSelect: (d: Department) => void
  onEdit: (d: Department) => void
  onAdd: () => void
  onDepartmentsChange: (next: Department[]) => void
}

function OrgChartInner({
  departments,
  colorMap,
  canEdit,
  orgId,
  onSelect,
  onEdit,
  onAdd,
  onDepartmentsChange,
}: InnerProps) {
  const { setCenter } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges] = useEdgesState([])
  const [query, setQuery] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const highlightIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return new Set<string>()
    return new Set(departments.filter((d) => d.name.toLowerCase().includes(q)).map((d) => d.id))
  }, [query, departments])

  // Rebuild nodes when the server data, edit-ability, colors or highlight set changes.
  // (Transient drag moves go through onNodesChange and are persisted on drag stop.)
  useEffect(() => {
    setNodes(buildNodes(departments, colorMap, { canEdit, highlightIds, onEdit }))
    setEdges(buildEdges(departments, colorMap))
  }, [departments, colorMap, canEdit, highlightIds, onEdit, setNodes, setEdges])

  // Center on the first search match.
  useEffect(() => {
    if (highlightIds.size === 0) return
    const first = departments.find((d) => highlightIds.has(d.id))
    if (first) setCenter(first.position_x + 90, first.position_y + 45, { zoom: 1, duration: 400 })
  }, [highlightIds, departments, setCenter])

  // Anchor the view on the top of the tree (root/Executive) at a readable zoom.
  // Fitting all nodes would shrink a large org chart to an unreadable speck, so we
  // open at the root and let the user pan / use the minimap to explore downward.
  const focusTop = useCallback(
    (duration = 0) => {
      if (!departments.length) return
      const ids = new Set(departments.map((d) => d.id))
      const root =
        departments
          .filter((d) => !d.parent_department_id || !ids.has(d.parent_department_id))
          .sort((a, b) => a.position_y - b.position_y)[0] ?? departments[0]
      setCenter(root.position_x + 90, root.position_y + 240, { zoom: 0.75, duration })
    },
    [departments, setCenter],
  )

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const dept = departments.find((d) => d.id === node.id)
      if (dept) onSelect(dept)
    },
    [departments, onSelect],
  )

  const handleDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      if (!canEdit) return
      // Reflect immediately so panels/auto-arrange use fresh coords.
      onDepartmentsChange(
        departments.map((d) =>
          d.id === node.id ? { ...d, position_x: node.position.x, position_y: node.position.y } : d,
        ),
      )
      try {
        setSaveStatus('saving')
        await updateDepartmentPosition(orgId, node.id, node.position.x, node.position.y)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 1800)
      } catch {
        setSaveStatus('error')
      }
    },
    [canEdit, departments, onDepartmentsChange, orgId],
  )

  const handleAutoArrange = useCallback(async () => {
    const layout = computeTreeLayout(departments)
    const next = departments.map((d) => ({
      ...d,
      position_x: layout[d.id]?.x ?? d.position_x,
      position_y: layout[d.id]?.y ?? d.position_y,
    }))
    onDepartmentsChange(next)
    setTimeout(() => focusTop(400), 60)
    try {
      setSaveStatus('saving')
      await Promise.all(
        next.map((d) => updateDepartmentPosition(orgId, d.id, d.position_x, d.position_y)),
      )
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1800)
    } catch {
      setSaveStatus('error')
    }
  }, [departments, onDepartmentsChange, orgId, focusTop])

  return (
    <div
      className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden"
      style={{ height: 640 }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E2E8F0] flex-wrap">
        <span className="text-sm font-semibold text-[#0F172A]">Department hierarchy</span>

        <div className="relative ml-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-44 rounded-[8px] border border-[#CBD5E1] bg-white pl-8 pr-3 py-1.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 focus:border-[#2563EB] transition-colors"
          />
        </div>

        {/* Save status */}
        {canEdit && (
          <span className="text-xs min-w-[90px]">
            {saveStatus === 'saving' && <span className="text-[#94A3B8]">Saving…</span>}
            {saveStatus === 'saved' && (
              <span className="text-[#16A34A] inline-flex items-center gap-1">
                <Check size={13} /> All changes saved
              </span>
            )}
            {saveStatus === 'error' && <span className="text-[#DC2626]">Save failed</span>}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            <>
              <button
                onClick={onAdd}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors"
              >
                <Plus size={15} /> Add Department
              </button>
              <button
                onClick={handleAutoArrange}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-medium bg-white border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors"
              >
                <LayoutGrid size={15} /> Auto-arrange
              </button>
            </>
          )}
          <button
            onClick={exportPng}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-medium bg-white border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors"
          >
            <Download size={15} /> Export PNG
          </button>
        </div>
      </div>

      <div style={{ height: 'calc(640px - 57px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          nodesDraggable={canEdit}
          nodesConnectable={false}
          onNodeClick={handleNodeClick}
          onNodeDragStop={handleDragStop}
          onInit={() => focusTop(0)}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          // Scroll/trackpad pans; ctrl/cmd+scroll and pinch zoom.
          panOnScroll
          panOnScrollMode={PanOnScrollMode.Free}
          zoomOnScroll={false}
          zoomOnPinch
          zoomActivationKeyCode={['Control', 'Meta']}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E2E8F0" />
          <Controls showInteractive={false} />
          <MiniMap nodeColor={() => '#2563EB'} maskColor="rgba(15,23,42,0.05)" pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ canEdit, onAdd }: { canEdit: boolean; onAdd: () => void }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
        <Network size={28} className="text-[#94A3B8]" />
      </div>
      <h2 className="text-lg font-semibold text-[#0F172A]">No departments yet</h2>
      <p className="text-[#475569] text-sm mt-1 max-w-xs">
        {canEdit
          ? 'Add your first department to start building the structure.'
          : 'Departments will appear here once they are created.'}
      </p>
      {canEdit && (
        <button
          onClick={onAdd}
          className="mt-5 flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus size={15} /> Add Department
        </button>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const { can } = usePermissions()
  const canEdit = can(STRUCTURE_LEAF, 'edit')

  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<Department | null>(null)
  const [formTarget, setFormTarget] = useState<DeptFormTarget | null>(null)

  const openEdit = useCallback((d: Department) => setFormTarget({ mode: 'edit', department: d }), [])
  const openCreate = useCallback(() => setFormTarget({ mode: 'create' }), [])

  const colorMap = useMemo(() => computeNodeColors(departments), [departments])

  const reload = useCallback(async () => {
    if (!orgId) return
    const [depts, emps, usrs] = await Promise.all([
      getDepartments(orgId),
      getEmployees(orgId).catch(() => [] as EmployeeProfile[]),
      getUsers(orgId).catch(() => [] as User[]),
    ])
    setDepartments(depts)
    setEmployees(emps)
    setUsers(usrs)
  }, [orgId])

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    reload().finally(() => setLoading(false))
  }, [orgId, reload])

  // Keep the open info panel in sync with refreshed data.
  const selectedLive = selected ? departments.find((d) => d.id === selected.id) ?? null : null
  const members = useMemo(
    () => (selectedLive ? employees.filter((e) => e.department_id === selectedLive.id) : []),
    [selectedLive, employees],
  )
  const subDepartments = useMemo(
    () =>
      selectedLive ? departments.filter((d) => d.parent_department_id === selectedLive.id) : [],
    [selectedLive, departments],
  )
  // Ancestor chain (root → immediate parent) for breadcrumb back-navigation.
  const ancestors = useMemo(() => {
    if (!selectedLive) return []
    const byId = new Map(departments.map((d) => [d.id, d]))
    const chain: Department[] = []
    let pid = selectedLive.parent_department_id
    const guard = new Set<string>()
    while (pid && byId.has(pid) && !guard.has(pid)) {
      guard.add(pid)
      const parent = byId.get(pid)!
      chain.unshift(parent)
      pid = parent.parent_department_id
    }
    return chain
  }, [selectedLive, departments])

  const handleSaved = useCallback(
    (saved: Department) => {
      setFormTarget(null)
      // Merge then refetch for accurate counts/relations.
      setDepartments((prev) => {
        const exists = prev.some((d) => d.id === saved.id)
        return exists ? prev.map((d) => (d.id === saved.id ? { ...d, ...saved } : d)) : [...prev, saved]
      })
      reload()
    },
    [reload],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Department Structure</h1>
        <p className="mt-1 text-[15px] text-[#475569]">
          {canEdit
            ? 'Drag to arrange, click a department for details, and use the pencil to edit.'
            : 'Interactive view of your department structure and hierarchy.'}
        </p>
      </div>

      {departments.length === 0 ? (
        <EmptyState canEdit={canEdit} onAdd={openCreate} />
      ) : (
        <ReactFlowProvider>
          <OrgChartInner
            departments={departments}
            colorMap={colorMap}
            canEdit={canEdit}
            orgId={orgId}
            onSelect={setSelected}
            onEdit={openEdit}
            onAdd={openCreate}
            onDepartmentsChange={setDepartments}
          />
        </ReactFlowProvider>
      )}

      {/* Read-only detail drawer */}
      <DeptInfoPanel
        department={selectedLive}
        accentColor={selectedLive ? colorMap[selectedLive.id]?.base : undefined}
        ancestors={ancestors}
        members={members}
        subDepartments={subDepartments}
        canEdit={canEdit}
        onEdit={(d) => {
          setSelected(null)
          setFormTarget({ mode: 'edit', department: d })
        }}
        onSelectDepartment={(d) => setSelected(d)}
        onClose={() => setSelected(null)}
      />

      {/* Create / edit drawer */}
      {canEdit && (
        <DeptFormDrawer
          target={formTarget}
          departments={departments}
          users={users}
          orgId={orgId}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
