import React from 'react'
import type { EntryDateStatus } from '@/lib/types/reports'

// Where a task stands TODAY, from the dates — a coloured tag next to the work stage.
// A task past its due date and not finished always carries the red Overdue tag, no
// matter what stage the person left it in.
const STYLE: Record<EntryDateStatus, { label: string; bg: string; fg: string; border: string }> = {
  completed: { label: 'Completed', bg: '#DCFCE7', fg: '#15803D', border: '#BBF7D0' },
  overdue: { label: 'Overdue', bg: '#FEE2E2', fg: '#B91C1C', border: '#FECACA' },
  in_progress: { label: 'In Progress', bg: '#DBEAFE', fg: '#1D4ED8', border: '#BFDBFE' },
  not_yet_due: { label: 'Not Yet Due', bg: '#F1F5F9', fg: '#64748B', border: '#E2E8F0' },
  closed: { label: 'Closed', bg: '#F1F5F9', fg: '#64748B', border: '#E2E8F0' },
}

export function DateStatusTag({ status, daysLate }: { status: EntryDateStatus; daysLate?: number | null }) {
  const s = STYLE[status] ?? STYLE.not_yet_due
  const showDays = status === 'overdue' && daysLate != null && daysLate > 0
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.fg, border: `1px solid ${s.border}` }}
    >
      {s.label}
      {showDays && <span className="font-bold">· {daysLate} {daysLate === 1 ? 'day' : 'days'} late</span>}
    </span>
  )
}
