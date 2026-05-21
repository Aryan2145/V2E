'use client'

import { AlertTriangle, Info, XCircle } from 'lucide-react'
import type { HolidayCheckResult } from '@/lib/types/holidays'

interface Props {
  check: HolidayCheckResult | null
}

export default function HolidayWarningBadge({ check }: Props) {
  if (!check || check.is_working_day) return null

  const { action, reason, adjusted_date } = check

  if (action === 'skip_create') {
    return (
      <div className="flex items-start gap-2 mt-1.5 px-3 py-2 rounded-[8px] bg-[#FEE2E2] border border-[#FECACA]">
        <XCircle size={14} className="text-[#DC2626] shrink-0 mt-0.5" />
        <p className="text-xs text-[#DC2626] font-medium">
          {reason ? `${reason} — ` : ''}Tasks cannot be created on this date. Change the deadline.
        </p>
      </div>
    )
  }

  if (action === 'create_anyway') {
    return (
      <div className="flex items-start gap-2 mt-1.5 px-3 py-2 rounded-[8px] bg-[#FEF9C3] border border-[#FDE68A]">
        <Info size={14} className="text-[#CA8A04] shrink-0 mt-0.5" />
        <p className="text-xs text-[#CA8A04] font-medium">
          {reason ? `${reason} — ` : ''}This is a non-working day, but the task will still be created.
        </p>
      </div>
    )
  }

  const label = action === 'move_to_next_working_day' ? 'moved forward' : 'moved back'
  const formattedDate = adjusted_date
    ? new Date(adjusted_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="flex items-start gap-2 mt-1.5 px-3 py-2 rounded-[8px] bg-[#FEF9C3] border border-[#FDE68A]">
      <AlertTriangle size={14} className="text-[#D97706] shrink-0 mt-0.5" />
      <p className="text-xs text-[#D97706] font-medium">
        {reason ? `${reason} — ` : ''}Deadline will be {label}
        {formattedDate ? ` to ${formattedDate}` : ''}.
      </p>
    </div>
  )
}
