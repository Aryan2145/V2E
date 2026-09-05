'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export interface MultiSelectOption {
  value: string
  label: string
  /** Secondary line under the label (e.g. owner · due date). */
  hint?: string
  /** Optional colour dot to the left of the label. */
  color?: string
}

/** Max height (px) of the open panel — capped further by the room actually available. */
const PANEL_MAX = 280

/**
 * The clip rectangle (in viewport coords) that will crop the open panel: the nearest
 * ancestor that scrolls or hides its overflow, intersected with the viewport. The panel
 * is in-flow (absolute), so it renders inside — and is clipped by — this box, not the
 * whole screen. Mirrors StyledSelect so both behave identically inside modals.
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
  value: string[]
  onChange: (values: string[]) => void
  options: MultiSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  /** Shown inside the panel when there is nothing to pick. */
  emptyText?: string
  disabled?: boolean
  /** Classes for the outer wrapper — use to control width (defaults to full width). */
  wrapperClassName?: string
}

/**
 * Multi-select with removable chips — the styled counterpart to StyledSelect for
 * fields that take several values (per DESIGN_RULES: never a raw OS-native
 * `<select multiple>`).
 *
 * The open panel is IN-FLOW (absolute inside a relative wrapper) and flips
 * up/down against the nearest SCROLL CONTAINER, not the viewport — the same
 * rule StyledSelect follows, so it never opens into a clipped edge inside a
 * modal or a scrolling card.
 */
export default function MultiSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'Nothing to choose from.',
  disabled = false,
  wrapperClassName = 'w-full',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropUp, setDropUp] = useState(false)
  const [panelMaxH, setPanelMaxH] = useState(PANEL_MAX)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const selectedSet = useMemo(() => new Set(value), [value])
  const selectedOptions = useMemo(
    () => value.map((v) => options.find((o) => o.value === v)).filter(Boolean) as MultiSelectOption[],
    [value, options],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q),
    )
  }, [options, query])

  function toggleOpen() {
    if (disabled) return
    if (!open) {
      const rect = btnRef.current?.getBoundingClientRect()
      if (rect) {
        const clip = nearestClipRect(btnRef.current)
        const spaceBelow = clip.bottom - rect.bottom
        const spaceAbove = rect.top - clip.top
        const up = spaceBelow < PANEL_MAX && spaceAbove > spaceBelow
        setDropUp(up)
        const room = Math.max(0, (up ? spaceAbove : spaceBelow) - 8)
        setPanelMaxH(Math.min(PANEL_MAX, Math.max(140, room)))
      }
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggleValue(v: string) {
    if (selectedSet.has(v)) onChange(value.filter((x) => x !== v))
    else onChange([...value, v])
  }

  return (
    <div ref={wrapRef} className={`relative ${wrapperClassName}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2 min-h-[42px] rounded-[8px] border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-left hover:bg-white hover:border-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors disabled:bg-[#F1F5F9] disabled:text-[#94A3B8] disabled:cursor-not-allowed"
      >
        <span className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5 py-0.5">
          {selectedOptions.length === 0 ? (
            <span className="text-[15px] text-[#94A3B8]">{placeholder}</span>
          ) : (
            selectedOptions.map((o) => (
              <span
                key={o.value}
                className="inline-flex items-center gap-1 max-w-full rounded-[6px] border border-[#BFDBFE] bg-[#EFF6FF] pl-2 pr-1 py-0.5 text-[13px] font-medium text-[#1D4ED8]"
              >
                <span className="truncate">{o.label}</span>
                {/* A chip's × is a control inside a button, so it must not
                    re-open the panel — hence stopPropagation. */}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${o.label}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!disabled) onChange(value.filter((x) => x !== o.value))
                  }}
                  className="shrink-0 w-4 h-4 rounded-[4px] flex items-center justify-center text-[#2563EB] hover:bg-[#DBEAFE] hover:text-[#1D4ED8] cursor-pointer"
                >
                  <X size={11} />
                </span>
              </span>
            ))
          )}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#94A3B8] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 ${
            dropUp ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'
          } z-50 flex flex-col border border-[#E2E8F0] rounded-[10px] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.14)] overflow-hidden`}
          style={{ maxHeight: panelMaxH }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#F1F5F9] shrink-0">
            <Search size={14} className="text-[#94A3B8] shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 min-w-0 text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none bg-transparent"
            />
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[12px] font-medium text-[#475569] hover:text-[#0F172A] shrink-0"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[#475569]">
                {options.length === 0 ? emptyText : 'No matches.'}
              </p>
            ) : (
              filtered.map((o) => {
                const checked = selectedSet.has(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleValue(o.value)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                      checked ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 shrink-0 w-4 h-4 rounded-[4px] border flex items-center justify-center ${
                        checked ? 'bg-[#2563EB] border-[#2563EB] text-white' : 'border-[#CBD5E1] bg-white'
                      }`}
                    >
                      {checked && <Check size={11} />}
                    </span>
                    {o.color && (
                      <span
                        className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: o.color }}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] text-[#0F172A] truncate">{o.label}</span>
                      {o.hint && (
                        <span className="block text-[12px] text-[#475569] truncate">{o.hint}</span>
                      )}
                    </span>
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
