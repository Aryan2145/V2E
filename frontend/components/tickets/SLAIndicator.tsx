'use client'

import { getNow } from '@/lib/clock'
import type { TicketStatusType } from '@/lib/types/tickets'

interface SLAIndicatorProps {
  sla_due_at: string
  sla_breached: boolean
  status_type?: TicketStatusType
  created_at: string
}

export default function SLAIndicator({ sla_due_at, sla_breached, status_type, created_at }: SLAIndicatorProps) {
  const closed = status_type === 'closed_resolved' || status_type === 'closed_unresolved'
  if (closed) return null

  const now = getNow()
  const due = new Date(sla_due_at)
  const created = new Date(created_at)

  if (sla_breached || due < now) {
    const daysAgo = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
    return (
      <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]">
        Breached {daysAgo > 0 ? `${daysAgo}d ago` : 'today'}
      </span>
    )
  }

  const totalMs = due.getTime() - created.getTime()
  const elapsedMs = now.getTime() - created.getTime()
  const pct = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (pct >= 80) {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF9C3] text-[#D97706] border border-[#FDE68A]">
        Due in {daysLeft}d
      </span>
    )
  }

  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
      Due in {daysLeft}d
    </span>
  )
}
