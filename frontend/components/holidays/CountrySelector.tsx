'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, Loader2 } from 'lucide-react'
import { holidaysApi } from '@/lib/api/holidays'
import type { NagerCountry } from '@/lib/types/holidays'

const FLAG_BASE = 'https://flagcdn.com/16x12'

interface Props {
  orgId: string
  value: string | null
  onChange: (countryCode: string | null) => void
  disabled?: boolean
}

export default function CountrySelector({ orgId, value, onChange, disabled }: Props) {
  const [countries, setCountries] = useState<NagerCountry[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    holidaysApi.getAvailableCountriesForOrg(orgId)
      .then(setCountries)
      .finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = countries.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.countryCode.toLowerCase().includes(search.toLowerCase())
  )

  const selected = countries.find((c) => c.countryCode === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={[
          'flex items-center gap-2 w-full h-10 px-3 rounded-[8px] border text-sm text-left transition-colors',
          disabled ? 'bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed border-[#E2E8F0]' : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:border-[#2563EB] cursor-pointer',
          open ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20' : '',
        ].join(' ')}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin text-[#94A3B8]" />
        ) : selected ? (
          <>
            <img
              src={`${FLAG_BASE}/${selected.countryCode.toLowerCase()}.png`}
              width={16}
              height={12}
              alt={selected.countryCode}
              className="shrink-0"
            />
            <span>{selected.name}</span>
            <span className="ml-1 text-[#94A3B8]">({selected.countryCode})</span>
          </>
        ) : (
          <span className="text-[#94A3B8]">Select country...</span>
        )}
        <ChevronDown size={14} className="ml-auto text-[#94A3B8] shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-[#E2E8F0] rounded-[10px] shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#F8FAFC] rounded-[8px]">
              <Search size={13} className="text-[#94A3B8] shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search countries..."
                className="flex-1 bg-transparent text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#475569] hover:bg-[#F8FAFC] transition-colors"
            >
              <span className="italic">No country set</span>
            </button>
            {filtered.map((c) => (
              <button
                key={c.countryCode}
                type="button"
                onClick={() => { onChange(c.countryCode); setOpen(false); setSearch('') }}
                className={[
                  'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                  c.countryCode === value ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#0F172A] hover:bg-[#F8FAFC]',
                ].join(' ')}
              >
                <img
                  src={`${FLAG_BASE}/${c.countryCode.toLowerCase()}.png`}
                  width={16}
                  height={12}
                  alt={c.countryCode}
                  className="shrink-0"
                />
                <span>{c.name}</span>
                <span className="ml-1 text-[#94A3B8] text-xs">({c.countryCode})</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-sm text-[#94A3B8] text-center">No countries found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
