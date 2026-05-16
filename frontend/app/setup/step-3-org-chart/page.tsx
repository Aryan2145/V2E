'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Plus, X, ArrowRight, Users } from 'lucide-react'
import { getDepartments, createDepartment, updateDepartmentPosition } from '@/lib/api/departments'
import { getUsers } from '@/lib/api/users'
import { useAuth } from '@/lib/auth/context'
import Button from '@/components/ui/Button'
import type { Department, User } from '@/lib/types'

// ─── Custom dept node ──────────────────────────────────────────────────────────

function DeptNode({ data }: { data: Department & { headName?: string } }) {
  return (
    <div className="bg-white border-2 border-[#2563EB] rounded-[12px] shadow-md px-4 py-3 min-w-[180px]">
      <p className="font-bold text-sm text-[#0F172A] leading-tight">{data.name}</p>
      {data.headName && (
        <p className="text-xs text-[#94A3B8] mt-1">{data.headName}</p>
      )}
      {data._count && (
        <div className="mt-2 inline-flex items-center gap-1 bg-[#EFF6FF] rounded-[6px] px-2 py-0.5">
          <Users size={10} className="text-[#2563EB]" />
          <span className="text-[10px] font-semibold text-[#2563EB]">
            {data._count.roles} roles
          </span>
        </div>
      )}
    </div>
  )
}

const nodeTypes = { deptNode: DeptNode }

// ─── Dept to ReactFlow node ────────────────────────────────────────────────────

function deptToNode(dept: Department): Node {
  return {
    id: dept.id,
    type: 'deptNode',
    position: { x: dept.position_x, y: dept.position_y },
    data: {
      ...dept,
      headName: dept.head_user?.name,
    },
  }
}

function buildEdges(depts: Department[]): Edge[] {
  return depts
    .filter((d) => d.parent_department_id)
    .map((d) => ({
      id: `e-${d.parent_department_id}-${d.id}`,
      source: d.parent_department_id!,
      target: d.id,
      style: { stroke: '#CBD5E1', strokeWidth: 2 },
    }))
}

// ─── Add department side panel ─────────────────────────────────────────────────

interface AddPanelProps {
  departments: Department[]
  users: User[]
  orgId: string
  onClose: () => void
  onAdded: () => void
}

function AddDeptPanel({ departments, users, orgId, onClose, onAdded }: AddPanelProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState('')
  const [headUserId, setHeadUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls =
    'w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 focus:border-[#2563EB] transition-colors'
  const labelCls = 'text-sm font-medium text-[#374151] mb-1.5 block'

  const handleAdd = async () => {
    if (!name.trim()) { setError('Department name is required'); return }
    setSaving(true)
    setError(null)
    try {
      await createDepartment(orgId, {
        name: name.trim(),
        description: description.trim() || undefined,
        parent_department_id: parentId || undefined,
        head_user_id: headUserId || undefined,
        position_x: 100 + Math.random() * 300,
        position_y: 100 + Math.random() * 200,
      })
      onAdded()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create department.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="absolute right-0 top-0 h-full w-[320px] bg-white border-l border-[#E2E8F0] shadow-xl z-10 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
        <h3 className="font-semibold text-[#0F172A]">Add Department</h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
        <div>
          <label className={labelCls}>Department Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Engineering"
            className={inputCls}
            autoFocus
          />
          {error && <p className="text-xs text-[#DC2626] mt-1">{error}</p>}
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional description…"
            className="w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 focus:border-[#2563EB] transition-colors resize-none"
          />
        </div>
        <div>
          <label className={labelCls}>Parent Department</label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className={inputCls}
          >
            <option value="">None (top-level)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Department Head</label>
          <select
            value={headUserId}
            onChange={(e) => setHeadUserId(e.target.value)}
            className={inputCls}
          >
            <option value="">No head assigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="px-5 py-4 border-t border-[#E2E8F0] flex gap-3">
        <Button variant="primary" isLoading={saving} onClick={handleAdd}>
          Add Department
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ─── Inner flow (needs ReactFlowProvider context) ──────────────────────────────

interface FlowProps {
  orgId: string
  departments: Department[]
  users: User[]
  onRefresh: () => void
}

function OrgChartFlow({ orgId, departments, users, onRefresh }: FlowProps) {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState(departments.map(deptToNode))
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildEdges(departments))
  const [showPanel, setShowPanel] = useState(false)

  useEffect(() => {
    setNodes(departments.map(deptToNode))
    setEdges(buildEdges(departments))
  }, [departments])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      try {
        await updateDepartmentPosition(orgId, node.id, node.position.x, node.position.y)
      } catch {
        // Silently fail position saves
      }
    },
    [orgId]
  )

  return (
    <div className="relative flex-1 min-h-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[#F8FAFC] rounded-[12px] border border-[#E2E8F0]"
      >
        <Background color="#E2E8F0" gap={20} />
        <Controls className="bg-white border border-[#E2E8F0] rounded-[8px] shadow-sm" />
        <MiniMap
          nodeColor={() => '#2563EB'}
          maskColor="rgba(15,23,42,0.05)"
          className="border border-[#E2E8F0] rounded-[8px]"
        />
      </ReactFlow>

      {/* Toolbar overlay */}
      <div className="absolute top-3 left-3 flex gap-2 z-10">
        <Button variant="primary" size="sm" onClick={() => setShowPanel(true)}>
          <Plus size={14} /> Add Department
        </Button>
        <Button variant="secondary" size="sm" onClick={() => fitView({ padding: 0.2 })}>
          Fit to screen
        </Button>
      </div>

      {showPanel && (
        <AddDeptPanel
          departments={departments}
          users={users}
          orgId={orgId}
          onClose={() => setShowPanel(false)}
          onAdded={onRefresh}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Step3OrgChartPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organization_id ?? ''

  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!orgId) return
    try {
      const [depts, usersData] = await Promise.all([
        getDepartments(orgId),
        getUsers(orgId),
      ])
      setDepartments(depts)
      setUsers(usersData)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Page header */}
      <div>
        <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider mb-1">Step 3 of 5</p>
        <h1 className="text-[26px] font-bold text-[#0F172A]">Organization Structure</h1>
        <p className="text-sm text-[#475569] mt-1">
          Build your org chart by adding departments and connecting reporting relationships.
        </p>
      </div>

      {isLoading ? (
        <div className="h-[480px] rounded-[12px] bg-[#E2E8F0] animate-pulse" />
      ) : (
        <div className="h-[480px]">
          <ReactFlowProvider>
            <OrgChartFlow
              orgId={orgId}
              departments={departments}
              users={users}
              onRefresh={loadData}
            />
          </ReactFlowProvider>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => router.push('/setup/step-2-culture')}>
          Back
        </Button>
        <Button variant="primary" onClick={() => router.push('/setup/step-4-roles')}>
          Continue
          <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  )
}
