'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { HolidayType } from '@/lib/types/holidays'

const HOLIDAY_TYPES: HolidayType[] = ['national', 'company', 'regional', 'team', 'personal', 'leave']

interface HolidayFormData {
  name: string
  date: string
  type: HolidayType
  is_recurring_yearly: boolean
  description: string
}

interface Props {
  onAdd: (data: HolidayFormData) => Promise<void>
  buttonLabel?: string
}

const DEFAULT: HolidayFormData = {
  name: '',
  date: '',
  type: 'company',
  is_recurring_yearly: false,
  description: '',
}

export default function AddHolidayForm({ onAdd, buttonLabel = 'Add Holiday' }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<HolidayFormData>(DEFAULT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof HolidayFormData>(key: K, val: HolidayFormData[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function submit() {
    if (!form.name.trim() || !form.date) {
      setError('Name and date are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onAdd(form)
      setForm(DEFAULT)
      setOpen(false)
    } catch {
      setError('Failed to add holiday. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
      >
        <Plus size={15} />
        {buttonLabel}
      </button>
    )
  }

  return (
    <div className="mt-3 p-4 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0F172A]">New Holiday</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setForm(DEFAULT); setError('') }}
          className="p-1 rounded-[6px] hover:bg-[#F1F5F9] text-[#475569] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Name *</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Republic Day"
            className="w-full h-9 px-3 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:border-[#2563EB] outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Date *</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className="w-full h-9 px-3 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] bg-white focus:border-[#2563EB] outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => set('type', e.target.value as HolidayType)}
            className="w-full h-9 px-3 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] bg-white focus:border-[#2563EB] outline-none"
          >
            {HOLIDAY_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Description</label>
          <input
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Optional"
            className="w-full h-9 px-3 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:border-[#2563EB] outline-none"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.is_recurring_yearly}
          onChange={(e) => set('is_recurring_yearly', e.target.checked)}
          className="w-4 h-4 accent-[#2563EB]"
        />
        <span className="text-sm text-[#475569]">Repeat yearly on this date</span>
      </label>

      {error && <p className="text-xs text-[#DC2626]">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => { setOpen(false); setForm(DEFAULT); setError('') }}
          className="h-9 px-4 rounded-[8px] border-2 border-[#2563EB] text-sm font-semibold text-[#2563EB] bg-white hover:bg-[#EFF6FF] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={submit}
          className="h-9 px-4 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
        >
          {saving ? 'Adding...' : 'Add'}
        </button>
      </div>
    </div>
  )
}
