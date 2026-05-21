'use client'

import type { HolidayOnTaskAction, HolidayPriorityLevel } from '@/lib/types/holidays'

const ACTIONS: { value: HolidayOnTaskAction; label: string; desc: string }[] = [
  { value: 'move_to_next_working_day', label: 'Move Forward', desc: 'Shift deadline to next working day' },
  { value: 'move_to_prev_working_day', label: 'Move Backward', desc: 'Shift deadline to previous working day' },
  { value: 'create_anyway', label: 'Create Anyway', desc: 'Create task even on holidays' },
  { value: 'skip_create', label: 'Skip', desc: 'Do not create tasks on holidays' },
]

const PRIORITIES: { value: HolidayPriorityLevel; label: string; desc: string }[] = [
  { value: 'individual_first', label: 'Individual First', desc: 'Individual → Dept → Org' },
  { value: 'department_first', label: 'Department First', desc: 'Dept → Individual → Org' },
  { value: 'org_first', label: 'Org Only', desc: 'Use org-level rules only' },
]

interface Props {
  action: HolidayOnTaskAction
  priority: HolidayPriorityLevel
  onActionChange: (a: HolidayOnTaskAction) => void
  onPriorityChange: (p: HolidayPriorityLevel) => void
  disabled?: boolean
}

export default function HolidayConfigCard({ action, priority, onActionChange, onPriorityChange, disabled }: Props) {
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

      <div>
        <p className="text-sm font-semibold text-[#0F172A] mb-2">Holiday priority level</p>
        <div className="grid grid-cols-3 gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              disabled={disabled}
              onClick={() => onPriorityChange(p.value)}
              className={[
                'rounded-[10px] border px-3 py-3 text-left transition-colors',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                priority === p.value
                  ? 'border-[#2563EB] bg-[#EFF6FF]'
                  : 'border-[#E2E8F0] bg-white hover:border-[#2563EB]/40',
              ].join(' ')}
            >
              <p className={`text-sm font-semibold ${priority === p.value ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>{p.label}</p>
              <p className="text-xs text-[#475569] mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
