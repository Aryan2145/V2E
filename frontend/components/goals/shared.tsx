'use client'

import { useEffect, useState } from 'react'
import { getMyPermissions } from '@/lib/api/permissions'
import {
  PERSPECTIVE_META,
  STATUS_META,
  type GoalPerspective,
  type GoalStatus,
} from '@/lib/types/goals'

// ─── Formatting ────────────────────────────────────────────────────────────────

export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function toDateInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

// ─── Badges ──────────────────────────────────────────────────────────────────

export function PerspectiveBadge({ perspective }: { perspective: GoalPerspective | null | undefined }) {
  if (!perspective) return null
  const m = PERSPECTIVE_META[perspective]
  return (
    <span
      className="inline-flex items-center font-medium text-[12px] rounded-full px-2.5 py-0.5 border whitespace-nowrap"
      style={{ backgroundColor: m.bg, color: m.text, borderColor: m.border }}
    >
      {m.label}
    </span>
  )
}

export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  const m = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center font-medium text-[12px] rounded-full px-2.5 py-0.5 border whitespace-nowrap"
      style={{ backgroundColor: m.bg, color: m.text, borderColor: m.border }}
    >
      {m.label}
    </span>
  )
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const color = pct >= 100 ? '#16A34A' : pct >= 60 ? '#2563EB' : pct >= 30 ? '#D97706' : '#94A3B8'
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden min-w-[60px]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[13px] text-[#475569] tabular-nums w-9 text-right">{pct}%</span>
    </div>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-16 px-6">
      <div className="w-14 h-14 rounded-[16px] bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
        {icon}
      </div>
      <h3 className="text-[18px] font-semibold text-[#0F172A]">{title}</h3>
      <p className="text-sm text-[#475569] max-w-sm">{subtitle}</p>
      {action}
    </div>
  )
}

// ─── Permissions hook (foundation Access Rights) ───────────────────────────────

export interface GoalPerms {
  read: boolean
  write: boolean
  edit: boolean
  delete: boolean
}

const FALLBACK: GoalPerms = { read: false, write: false, edit: false, delete: false }

export function useGoalPermissions(orgId: string): { perms: GoalPerms; loading: boolean } {
  const [perms, setPerms] = useState<GoalPerms>(FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!orgId) {
      setLoading(false)
      return
    }
    getMyPermissions(orgId)
      .then((res) => {
        if (active) setPerms(res.leaves?.goals ?? FALLBACK)
      })
      .catch(() => active && setPerms(FALLBACK))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [orgId])

  return { perms, loading }
}
