'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type { RecurringTemplate } from '@/lib/types/tasks'
import QuadrantBadge from '@/components/tasks/QuadrantBadge'
import { RotateCcw, Play, Pause, Calendar, Users } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function scheduleLabel(t: RecurringTemplate): string {
  const type = t.schedule_type
  if (type === 'daily') return `Every ${t.every > 1 ? `${t.every} days` : 'day'}`
  if (type === 'weekly') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const days = (t.days ?? []).map((d) => dayNames[d]).join(', ')
    return `Every ${t.every > 1 ? `${t.every} weeks` : 'week'}${days ? ` on ${days}` : ''}`
  }
  if (type === 'monthly') return `Every ${t.every > 1 ? `${t.every} months` : 'month'}`
  return type
}

function formatDate(str: string): string {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const avatarColors = [
  'bg-[#2563EB]', 'bg-[#7C3AED]', 'bg-[#059669]',
  'bg-[#D97706]', 'bg-[#DC2626]', 'bg-[#0891B2]',
]
function avatarColor(str: string): string {
  let h = 0; for (let i = 0; i < str.length; i++) h += str.charCodeAt(i)
  return avatarColors[h % avatarColors.length]
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function RecurringCard({
  template,
  onPause,
  onResume,
}: {
  template: RecurringTemplate
  onPause: () => void
  onResume: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    try {
      if (template.is_active) await onPause()
      else await onResume()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <QuadrantBadge quadrant={template.quadrant} />
            <span
              className={[
                'inline-flex items-center rounded-[999px] px-2 py-0.5 text-[11px] font-medium',
                template.is_active
                  ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]'
                  : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]',
              ].join(' ')}
            >
              {template.is_active ? 'Active' : 'Paused'}
            </span>
          </div>
          <h3 className="text-[15px] font-semibold text-[#0F172A] truncate">{template.title}</h3>
          {template.description && (
            <p className="text-sm text-[#475569] mt-1 line-clamp-2">{template.description}</p>
          )}
        </div>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[8px] transition-colors disabled:opacity-60 shrink-0',
            template.is_active
              ? 'text-[#D97706] bg-[#FEF9C3] border border-[#FDE68A] hover:bg-[#FDE68A]'
              : 'text-[#16A34A] bg-[#DCFCE7] border border-[#BBF7D0] hover:bg-[#BBF7D0]',
          ].join(' ')}
        >
          {template.is_active ? <Pause size={12} /> : <Play size={12} />}
          {loading ? '...' : template.is_active ? 'Pause' : 'Resume'}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#475569]">
        <div className="flex items-center gap-1.5">
          <RotateCcw size={13} className="text-[#94A3B8]" />
          <span>{scheduleLabel(template)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={13} className="text-[#94A3B8]" />
          <span>From {formatDate(template.start_date)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <RotateCcw size={13} className="text-[#94A3B8]" />
          <span>{template.occurrence_count} occurrence{template.occurrence_count !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {template.assignee_user_ids && template.assignee_user_ids.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <Users size={13} className="text-[#94A3B8]" />
          <div className="flex -space-x-2">
            {template.assignee_user_ids.slice(0, 5).map((uid) => (
              <div
                key={uid}
                className={`w-6 h-6 rounded-full ${avatarColor(uid)} flex items-center justify-center text-white text-[9px] font-bold border-2 border-white`}
                title={uid}
              >
                {getInitials(uid)}
              </div>
            ))}
            {template.assignee_user_ids.length > 5 && (
              <div className="w-6 h-6 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[#475569] text-[9px] font-bold border-2 border-white">
                +{template.assignee_user_ids.length - 5}
              </div>
            )}
          </div>
          <span className="text-xs text-[#475569]">
            {template.assignee_user_ids.length} assignee{template.assignee_user_ids.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(() => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    tasksApi.getRecurringTemplates(orgId).then(setTemplates).catch(() => setTemplates([])).finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => { loadData() }, [loadData])

  async function handlePause(id: string) {
    await tasksApi.pauseRecurring(orgId, id)
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, is_active: false } : t))
  }

  async function handleResume(id: string) {
    await tasksApi.resumeRecurring(orgId, id)
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, is_active: true } : t))
  }

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="font-semibold text-[#0F172A]">No organization found</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Recurring Tasks</h1>
        <p className="mt-1 text-[15px] text-[#475569]">
          Scheduled task templates that automatically create new instances.
        </p>
      </div>

      <p className="text-sm text-[#475569]">
        {templates.length} template{templates.length !== 1 ? 's' : ''}
      </p>

      {templates.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
            <RotateCcw size={24} className="text-[#94A3B8]" />
          </div>
          <p className="font-semibold text-[#0F172A]">No recurring templates</p>
          <p className="text-sm text-[#475569] mt-1">Create a recurring task to set up automated schedules.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => (
            <RecurringCard
              key={t.id}
              template={t}
              onPause={() => handlePause(t.id)}
              onResume={() => handleResume(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
