'use client'

import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Zap } from 'lucide-react'
import { levelColors } from '@/lib/role-levels'
import { NODE_W } from '@/lib/employee-tree'
import type { EmployeeStatus, RoleLevel } from '@/lib/types'

export interface EmployeeNodeData {
  name: string
  roleTitle?: string
  level?: RoleLevel
  status: EmployeeStatus
  color: string // department base hue
  freeRadical?: boolean
}

const statusDot: Record<EmployeeStatus, string> = {
  active: 'bg-[#16A34A]',
  inactive: 'bg-[#DC2626]',
  on_leave: 'bg-[#CA8A04]',
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'
}

function EmployeeNode({ data }: { data: EmployeeNodeData }) {
  const { name, roleTitle, level, status, color, freeRadical } = data
  return (
    <div
      className={`relative rounded-[12px] bg-white border shadow-[0_1px_3px_rgba(0,0,0,0.08)] ${
        freeRadical ? 'border-dashed border-[#CBD5E1]' : 'border-[#E2E8F0]'
      }`}
      style={{ width: NODE_W, borderLeft: `4px solid ${color}` }}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#94A3B8] !w-2 !h-2 !border-0" />

      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span
          className="w-9 h-9 shrink-0 rounded-full inline-flex items-center justify-center text-[11px] font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[status]}`} />
            <p className="text-sm font-semibold text-[#0F172A] truncate">{name}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xs text-[#64748B] truncate">{roleTitle ?? 'No role'}</p>
            {level && (
              <span
                className={`inline-flex items-center rounded-[999px] px-1.5 py-px text-[10px] font-semibold capitalize shrink-0 ${levelColors[level]}`}
              >
                {level}
              </span>
            )}
          </div>
        </div>
      </div>

      {freeRadical && (
        <span className="absolute -top-2 -right-2 inline-flex items-center gap-0.5 rounded-[999px] bg-[#F1F5F9] border border-[#E2E8F0] px-1.5 py-px text-[10px] font-semibold text-[#64748B]">
          <Zap size={10} className="text-[#CA8A04]" /> unlinked
        </span>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-[#94A3B8] !w-2 !h-2 !border-0" />
    </div>
  )
}

export default memo(EmployeeNode)
