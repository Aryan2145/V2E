'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface StyledSelectOption {
  value: string
  label: string
  /** Optional color dot shown to the left of the label (e.g. priority/status color). */
  color?: string
}

/** Max height (px) of the open panel — capped further by the room actually available. */
const PANEL_MAX = 260

/**
 * The clip rectangle (in viewport coords) that will crop the open panel: the nearest
 * ancestor that scrolls or hides its overflow, intersected with the viewport. The panel
 * is in-flow (absolute), so it renders inside — and is clipped by — this box, not the
 * whole screen. We open toward whichever side has real room INSIDE it so a card sitting
 * at the top of a scroll column drops DOWN instead of opening up into the clipped edge.
 */
function nearestClipRect(el: HTMLElement | null): { top: number; bottom: number } {
  let node = el?.parentElement ?? null
  while (node) {
    const oy = window.getComputedStyle(node).overflowY
    if (oy === 'auto' || oy === 'scroll' || oy === 'hidden') {
      const r = node.getBoundingClientRect()
      return { top: Math.max(0, r.top), bottom: Math.min(window.innerHeight, r.bottom) }
    }
    node = node.parentElement
  }
  return { top: 0, bottom: window.innerHeight }
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
  // Open upward when the trigger sits low (e.g. bottom of a modal), so the list
  // never opens where it can't be reached.
  const [dropUp, setDropUp] = useState(false)
  // The open panel is in-flow (absolute), so a scrolling/overflow ancestor CLIPS it.
  // Cap its height to the real room available on the chosen side so it is never
  // sliced off behind the card edge — it always renders fully OVER the card.
  const [panelMaxH, setPanelMaxH] = useState(PANEL_MAX)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const toggle = () => {
    if (!open) {
      const rect = btnRef.current?.getBoundingClientRect()
      if (rect) {
        // Measure room against the nearest CLIPPING ancestor (a scroll container
        // like a card's independent-scroll column), not just the viewport. A card
        // at the TOP of such a column has little room above — so we must drop DOWN
        // even if the viewport has space above, otherwise the upward panel is clipped
        // by the container's top edge and its options hide behind the card.
        const clip = nearestClipRect(btnRef.current)
        const spaceBelow = clip.bottom - rect.bottom
        const spaceAbove = rect.top - clip.top
        const up = spaceBelow < PANEL_MAX && spaceAbove > spaceBelow
        setDropUp(up)
        // Fit within the chosen side's un-clipped room (never exceed PANEL_MAX).
        const room = Math.max(0, (up ? spaceAbove : spaceBelow) - 8)
        setPanelMaxH(Math.min(PANEL_MAX, Math.max(120, room)))
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
        <div
          style={{ maxHeight: panelMaxH }}
          className={`absolute left-0 right-0 ${dropUp ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'} z-50 flex flex-col border border-[#E2E8F0] rounded-[10px] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.14)] overflow-hidden`}
        >
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
