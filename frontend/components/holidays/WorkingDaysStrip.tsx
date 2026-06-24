'use client'

import { Check, Loader2 } from 'lucide-react'

const DAY_PILLS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props {
  /** Effective working days on the pills — this entity's override, or the inherited defaults. */
  days: number[]
  /** Whether this entity overrides its parent defaults. */
  override: boolean
  status: 'idle' | 'saving' | 'saved'
  disabled?: boolean
  /** Label for the override switch — e.g. "Override org defaults". */
  overrideLabel?: string
  /** Idle hint shown when not overriding — e.g. "Following org days". */
  followingLabel?: string
  onToggleDay: (dayIndex: number) => void
  onToggleOverride: (next: boolean) => void
}

/**
 * Slim working-days strip with an "override parent defaults" switch. Pills are
 * editable only while overriding; everything auto-saves. Shared by the department
 * and individual calendars so the control feels identical across both.
 */
export default function WorkingDaysStrip({
  days,
  override,
  status,
  disabled,
  overrideLabel = 'Override org defaults',
  followingLabel = 'Following org days',
  onToggleDay,
  onToggleOverride,
}: Props) {
  const pillsDisabled = disabled || !override

  return (
    <div className="flex items-center gap-4 flex-wrap bg-white border border-[#E2E8F0] rounded-[12px] px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <span className="text-sm font-semibold text-[#0F172A] shrink-0">Working Days</span>

      <div className="flex items-center gap-1.5">
        {DAY_PILLS.map((label, index) => {
          const active = days.includes(index)
          return (
            <button
              key={index}
              type="button"
              onClick={() => onToggleDay(index)}
              disabled={pillsDisabled}
              title={DAY_NAMES[index]}
              aria-pressed={active}
              className={[
                'h-8 w-8 rounded-full text-xs font-semibold border transition-colors duration-150',
                pillsDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
                active
                  ? pillsDisabled
                    ? 'bg-[#BFDBFE] text-white border-[#BFDBFE]'
                    : 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-[#94A3B8] border-[#E2E8F0] ' + (pillsDisabled ? '' : 'hover:border-[#2563EB] hover:text-[#2563EB]'),
              ].join(' ')}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Override switch */}
      <label className={`flex items-center gap-2 select-none ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          checked={override}
          disabled={disabled}
          onChange={(e) => onToggleOverride(e.target.checked)}
          className="w-4 h-4 accent-[#2563EB]"
        />
        <span className="text-sm text-[#475569]">{overrideLabel}</span>
      </label>

      <span className="ml-auto text-xs text-[#94A3B8] min-w-[60px]">
        {status === 'saving' && (
          <span className="flex items-center gap-1 text-[#475569]"><Loader2 size={12} className="animate-spin" /> Saving…</span>
        )}
        {status === 'saved' && (
          <span className="flex items-center gap-1 text-[#16A34A]"><Check size={12} /> Saved</span>
        )}
        {status === 'idle' && !override && (
          <span className="text-[#94A3B8]">{followingLabel}</span>
        )}
      </span>
    </div>
  )
}
