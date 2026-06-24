'use client'

import { Info } from 'lucide-react'
import type { HolidayOnTaskAction } from '@/lib/types/holidays'

const ACTIONS: { value: HolidayOnTaskAction; label: string; desc: string }[] = [
  { value: 'move_to_next_working_day', label: 'Move Forward', desc: 'Shift deadline to next working day' },
  { value: 'move_to_prev_working_day', label: 'Move Backward', desc: 'Shift deadline to previous working day' },
  { value: 'create_anyway', label: 'Create Anyway', desc: 'Create task even on holidays' },
  { value: 'skip_create', label: 'Skip', desc: 'Do not create tasks on holidays' },
]

interface Props {
  action: HolidayOnTaskAction
  onActionChange: (a: HolidayOnTaskAction) => void
  disabled?: boolean
}

export default function HolidayConfigCard({ action, onActionChange, disabled }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-[#0F172A] mb-2">When a deadline falls on a holiday…</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ACTIONS.map((a) => (
            <button
              key={a.value}
              type="button"
              disabled={disabled}
              onClick={() => onActionChange(a.value)}
              className={[
                'rounded-[10px] border px-3 py-3 text-left transition-colors',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                action === a.value
                  ? 'border-[#2563EB] bg-[#EFF6FF]'
                  : 'border-[#E2E8F0] bg-white hover:border-[#2563EB]/40',
              ].join(' ')}
            >
              <p className={`text-sm font-semibold ${action === a.value ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>{a.label}</p>
              <p className="text-xs text-[#475569] mt-0.5">{a.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] p-3">
        <Info size={16} className="text-[#2563EB] mt-0.5 shrink-0" />
        <p className="text-sm text-[#475569]">
          Holidays now cascade automatically: <span className="font-medium text-[#0F172A]">org holidays apply to every department and employee</span>,
          departments and individuals add their own on top, and any level can remove the ones it doesn&apos;t observe.
          There is no priority setting to configure.
        </p>
      </div>
    </div>
  )
}
