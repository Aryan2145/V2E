'use client'

import React, { useState } from 'react'
import { GitBranch, Play, Edit2, MoreVertical, Archive, Users, Calendar, Zap, CheckCircle2 } from 'lucide-react'
import type { WorkflowTemplate } from '@/lib/types/workflows'

const avatarColors = [
  'bg-[#2563EB]', 'bg-[#7C3AED]', 'bg-[#059669]', 'bg-[#D97706]', 'bg-[#DC2626]', 'bg-[#0891B2]',
]
function avatarColor(str: string): string {
  let h = 0; for (let i = 0; i < str.length; i++) h += str.charCodeAt(i)
  return avatarColors[h % avatarColors.length]
}
function initials(name: string): string {
  return name.split(' ').map((n) => n[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]',
  draft: 'bg-[#FEF9C3] text-[#CA8A04] border border-[#FDE68A]',
  archived: 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]',
}

const TRIGGER_ICONS: Record<string, string> = {
  date_trigger: '📅',
  manual_trigger: '👆',
  task_completed_trigger: '✅',
  task_overdue_trigger: '⚠️',
}

interface Props {
  workflow: WorkflowTemplate
  onTrigger?: (workflow: WorkflowTemplate) => void
  onEdit?: (workflow: WorkflowTemplate) => void
  onArchive?: (workflow: WorkflowTemplate) => void
  canEdit?: boolean
}

export default function WorkflowCard({ workflow, onTrigger, onEdit, onArchive, canEdit }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 flex flex-col gap-4 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-[10px] bg-[#EFF6FF] flex items-center justify-center shrink-0">
          <GitBranch size={18} className="text-[#2563EB]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold text-[#0F172A] truncate">{workflow.name}</h3>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[workflow.status] ?? STATUS_STYLES.draft}`}>
              {workflow.status}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569]">
              {workflow.workflow_nature === 'recurring' ? 'Recurring' : 'One-time'}
            </span>
          </div>
          {workflow.description && (
            <p className="text-sm text-[#475569] mt-0.5 line-clamp-2">{workflow.description}</p>
          )}
        </div>
        {/* Menu */}
        {canEdit && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 bg-white border border-[#E2E8F0] rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] w-40 py-1">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onEdit?.(workflow) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                  <Edit2 size={14} className="text-[#475569]" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onArchive?.(workflow) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#DC2626] hover:bg-[#FFF5F5]"
                >
                  <Archive size={14} /> Archive
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Steps */}
        <div className="flex items-center gap-1.5 text-sm text-[#475569]">
          <CheckCircle2 size={14} className="text-[#94A3B8]" />
          <span>{workflow.steps?.length ?? 0} steps</span>
        </div>

        {/* Instances */}
        {workflow._count && (
          <div className="flex items-center gap-1.5 text-sm text-[#475569]">
            <GitBranch size={14} className="text-[#94A3B8]" />
            <span>{workflow._count.instances} instances</span>
          </div>
        )}

        {/* Triggers */}
        {workflow.triggers && workflow.triggers.length > 0 && (
          <div className="flex items-center gap-1">
            {workflow.triggers.map((t) => (
              <span
                key={t.id}
                title={t.type.replace(/_/g, ' ')}
                className="text-[13px] px-1.5 py-0.5 rounded-[4px] bg-[#F1F5F9] text-[#475569]"
              >
                {TRIGGER_ICONS[t.type] ?? '🔧'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Owners */}
      {workflow.owner_user_ids.length > 0 && (
        <div className="flex items-center gap-2">
          <Users size={13} className="text-[#94A3B8]" />
          <div className="flex -space-x-1.5">
            {workflow.owner_user_ids.slice(0, 4).map((uid) => (
              <div
                key={uid}
                className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-bold ${avatarColor(uid)}`}
              >
                {initials(uid)}
              </div>
            ))}
            {workflow.owner_user_ids.length > 4 && (
              <div className="w-6 h-6 rounded-full border-2 border-white bg-[#F1F5F9] flex items-center justify-center text-[#475569] text-[9px] font-semibold">
                +{workflow.owner_user_ids.length - 4}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#F1F5F9]">
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit?.(workflow)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-sm font-medium text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors"
          >
            <Edit2 size={13} /> Edit
          </button>
        )}
        {workflow.status === 'active' && (
          <button
            type="button"
            onClick={() => onTrigger?.(workflow)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
          >
            <Play size={13} /> Trigger
          </button>
        )}
        <div className="ml-auto flex items-center gap-1 text-xs text-[#94A3B8]">
          <Calendar size={11} />
          {new Date(workflow.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </div>
  )
}
