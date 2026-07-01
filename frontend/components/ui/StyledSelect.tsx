'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface StyledSelectOption {
  value: string
  label: string
  /** Optional color dot shown to the left of the label (e.g. priority/status color). */
  color?: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: StyledSelectOption[]
  placeholder?: string
  /** Classes for the outer wrapper — use to control width (defaults to full width). */
  wrapperClassName?: string
  /** Extra classes merged onto the trigger button — for size/theme overrides (e.g. compact filters, dark bars). */
  triggerClassName?: string
  disabled?: boolean
}

/**
 * Shared dropdown whose OPEN LIST is a styled panel (not the raw OS-native menu):
 * curved #E2E8F0 box, white background + shadow, hover states, and a blue active
 * checkmark — per DESIGN_RULES.md. The panel renders IN-FLOW (absolute within a
 * relative wrapper) so it scrolls with the trigger and never drifts; safe inside
 * modals and on scrollable pages alike. See memory: no-overflow-parent.
 *
 * Use this anywhere a styled select with a small/medium option list is needed.
 * For the large, searchable, tree department picker use DepartmentSelect instead.
 */
export default function StyledSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  wrapperClassName = 'w-full',
  triggerClassName = '',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  // Open upward when the trigger sits low in the viewport (e.g. bottom of a modal),
  // so the list never opens below the fold where it can't be reached.
  const [dropUp, setDropUp] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const PANEL_MAX = 260

  const toggle = () => {
    if (!open) {
      const rect = btnRef.current?.getBoundingClientRect()
      if (rect) {
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top
        setDropUp(spaceBelow < PANEL_MAX && spaceAbove > spaceBelow)
      }
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find((o) => o.value === value) ?? null

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const triggerCls =
    'w-full flex items-center gap-2.5 border border-[#CBD5E1] rounded-[8px] px-3 py-2.5 text-[15px] text-left bg-[#F8FAFC] hover:bg-white hover:border-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors disabled:bg-[#F1F5F9] disabled:text-[#94A3B8] disabled:cursor-not-allowed'

  return (
    <div ref={wrapRef} className={`relative ${wrapperClassName}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        className={`${triggerCls} ${triggerClassName}`}
      >
        {selected ? (
          <>
            {selected.color && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selected.color }}
              />
            )}
            <span className="flex-1 min-w-0 truncate text-[#0F172A]">{selected.label}</span>
          </>
        ) : (
          <span className="flex-1 text-[#94A3B8]">{placeholder}</span>
        )}
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#94A3B8] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className={`absolute left-0 right-0 ${dropUp ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'} z-50 flex flex-col max-h-[260px] border border-[#E2E8F0] rounded-[10px] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.14)] overflow-hidden`}>
          <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 py-1">
            {options.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[#94A3B8]">No options.</p>
            ) : (
              options.map((o) => {
                const isSel = o.value === value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => pick(o.value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      isSel ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {o.color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: o.color }}
                      />
                    )}
                    <span
                      className={`flex-1 min-w-0 truncate text-sm font-medium ${
                        isSel ? 'text-[#2563EB]' : 'text-[#0F172A]'
                      }`}
                    >
                      {o.label}
                    </span>
                    {isSel && <Check size={15} className="text-[#2563EB] shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
