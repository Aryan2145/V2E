'use client'

import React, { useState } from 'react'
import { X, CheckCircle2, CalendarClock } from 'lucide-react'
import type { TaskStatus } from '@/lib/types/tasks'
import StyledSelect from '@/components/ui/StyledSelect'
import DatePicker from '@/components/ui/DatePicker'

/**
 * Floating bulk-action bar shown while rows are selected: change status, set a deadline,
 * mark complete, across the selected set (scope-gated server-side).
 */
export default function BulkActionBar({
  count,
  statuses,
  busy,
  onStatus,
  onComplete,
  onDeadline,
  onClear,
}: {
  count: number
  statuses: TaskStatus[]
  busy: boolean
  onStatus: (statusId: string) => void
  onComplete: () => void
  onDeadline: (date: string) => void
  onClear: () => void
}) {
  const [deadline, setDeadline] = useState('')
  if (count === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl">
      <div className="bg-[#0F172A] text-white rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.25)] px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold whitespace-nowrap">{count} selected</span>
        <div className="h-5 w-px bg-[#334155] hidden sm:block" />

        <div className="flex items-center gap-2 flex-wrap flex-1">
          <StyledSelect
            value=""
            disabled={busy}
            onChange={(v) => v && onStatus(v)}
            wrapperClassName="w-[150px]"
            triggerClassName="!bg-[#1E293B] hover:!bg-[#1E293B] focus:!bg-[#1E293B] !border-[#334155] !text-white"
            placeholder="Set status…"
            options={[
              { value: '', label: 'Set status…' },
              // "Partially Completed" is system-derived only (never hand-set); keep it out of bulk.
              ...statuses
                .filter((s) => s.type !== 'partially_completed')
                .map((s) => ({ value: s.id, label: s.label, color: s.color })),
            ]}
          />

          <div className="w-[160px]">
            <DatePicker
              value={deadline}
              onChange={(v: string) => { setDeadline(v); if (v) onDeadline(v) }}
              placeholder="Set deadline"
            />
          </div>

          <button
            onClick={onComplete}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] disabled:opacity-60 transition-colors"
          >
            <CheckCircle2 size={15} /> Complete
          </button>
        </div>

        <button onClick={onClear} className="flex items-center gap-1 text-sm text-[#CBD5E1] hover:text-white transition-colors">
          <X size={15} /> Clear
        </button>
      </div>
    </div>
  )
}
