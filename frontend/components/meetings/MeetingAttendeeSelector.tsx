'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Search, Plus } from 'lucide-react'

export interface PersonOption {
  user_id: string
  name: string
  email?: string
}

interface Props {
  options: PersonOption[]
  value: string[]
  onChange: (ids: string[]) => void
  excludeIds?: string[]
  placeholder?: string
}

export default function MeetingAttendeeSelector({ options, value, onChange, excludeIds = [], placeholder = 'Add attendees…' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const byId = useMemo(() => new Map(options.map((o) => [o.user_id, o])), [options])
  const available = useMemo(
    () =>
      options.filter(
        (o) =>
          !value.includes(o.user_id) &&
          !excludeIds.includes(o.user_id) &&
          o.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [options, value, excludeIds, query],
  )

  function add(id: string) {
    onChange([...value, id])
    setQuery('')
  }
  function remove(id: string) {
    onChange(value.filter((v) => v !== id))
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1.5 items-center min-h-[42px] p-1.5 border border-[#CBD5E1] rounded-[8px] bg-white">
        {value.map((id) => {
          const o = byId.get(id)
          return (
            <span key={id} className="inline-flex items-center gap-1 bg-[#EFF6FF] text-[#1E293B] text-sm rounded-full pl-2.5 pr-1 py-0.5">
              {o?.name ?? 'Unknown'}
              <button type="button" onClick={() => remove(id)} className="text-[#94A3B8] hover:text-[#DC2626]" aria-label="Remove">
                <X size={13} />
              </button>
            </span>
          )
        })}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-sm text-[#2563EB] hover:text-[#1D4ED8] px-2 py-0.5"
        >
          <Plus size={14} /> {value.length === 0 ? placeholder : 'Add'}
        </button>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto bg-white border border-[#E2E8F0] rounded-[10px] shadow-lg">
          <div className="sticky top-0 bg-white p-2 border-b border-[#F1F5F9]">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Escape closes only this dropdown — never the parent modal/form.
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    e.stopPropagation()
                    setOpen(false)
                  }
                }}
                placeholder="Search people…"
                className="w-full pl-8 pr-2 py-1.5 text-sm border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>
          {available.length === 0 ? (
            <p className="px-3 py-3 text-sm text-[#94A3B8]">No one to add.</p>
          ) : (
            available.map((o) => (
              <button
                key={o.user_id}
                type="button"
                onClick={() => add(o.user_id)}
                className="w-full text-left px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
              >
                {o.name}
                {o.email && <span className="text-[#94A3B8] ml-2 text-xs">{o.email}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
