'use client'

import { useEffect, useState, useCallback } from 'react'
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  BackgroundVariant,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAuth } from '@/lib/auth/context'
import { getDepartments } from '@/lib/api/departments'
import DeptNode from '@/components/org-chart/DeptNode'
import type { Department } from '@/lib/types'
import { Download, Network } from 'lucide-react'

// ─── Node types registration ──────────────────────────────────────────────────

const nodeTypes = { deptNode: DeptNode }

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildNodes(departments: Department[], readOnly: boolean): Node[] {
  return departments.map((dept) => ({
    id: dept.id,
    type: 'deptNode',
    position: { x: dept.position_x, y: dept.position_y },
    data: {
      name: dept.name,
      headName: dept.head_user?.name,
      teamCount: dept._count?.employee_profiles ?? 0,
      roleCount: dept._count?.roles ?? 0,
      readOnly,
    },
    draggable: !readOnly,
  }))
}

function buildEdges(departments: Department[]): Edge[] {
  return departments
    .filter((d) => d.parent_department_id)
    .map((d) => ({
      id: `e-${d.parent_department_id}-${d.id}`,
      source: d.parent_department_id!,
      target: d.id,
      style: { stroke: '#CBD5E1', strokeWidth: 2 },
      type: 'smoothstep',
    }))
}

// ─── Export helper ─────────────────────────────────────────────────────────────

function ExportButton() {
  const handleExport = useCallback(async () => {
    const el = document.querySelector('.react-flow') as HTMLElement | null
    if (!el) return
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', useCORS: true })
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = 'org-chart.png'
      link.click()
    } catch (err) {
      console.error('Export failed', err)
    }
  }, [])

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-sm font-medium bg-white border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] hover:border-[#CBD5E1] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors duration-150"
    >
      <Download size={15} />
      Export PNG
    </button>
  )
}

// ─── Inner chart (must be inside ReactFlowProvider) ───────────────────────────

function OrgChartInner({
  nodes,
  edges,
  readOnly,
}: {
  nodes: Node[]
  edges: Edge[]
  readOnly: boolean
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden" style={{ height: 600 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
        <span className="text-sm font-semibold text-[#0F172A]">Department hierarchy</span>
        <ExportButton />
      </div>
      <div style={{ height: 'calc(600px - 53px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={!readOnly}
          nodesConnectable={false}
          elementsSelectable={!readOnly}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E2E8F0" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
        <Network size={28} className="text-[#94A3B8]" />
      </div>
      <h2 className="text-lg font-semibold text-[#0F172A]">No departments yet</h2>
      <p className="text-[#475569] text-sm mt-1 max-w-xs">
        Create departments in the setup wizard to see your org chart here.
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const readOnly = user?.role === 'employee'

  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    getDepartments(orgId)
      .then(setDepartments)
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false))
  }, [orgId])

  const nodes = buildNodes(departments, readOnly)
  const edges = buildEdges(departments)

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
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Org Chart</h1>
        <p className="mt-1 text-[15px] text-[#475569]">
          Interactive view of your department structure and hierarchy.
        </p>
      </div>

      {departments.length === 0 ? (
        <EmptyState />
      ) : (
        <ReactFlowProvider>
          <OrgChartInner nodes={nodes} edges={edges} readOnly={readOnly} />
        </ReactFlowProvider>
      )}
    </div>
  )
}
