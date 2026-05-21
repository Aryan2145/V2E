'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { IndividualWorkingDays } from '@/lib/types/holidays'
import WorkingDaysToggle from './WorkingDaysToggle'

interface DraftSchedule {
  working_days: number[]
  valid_from: string
  valid_to: string
}

interface Props {
  schedules: IndividualWorkingDays[]
  onAdd: (data: DraftSchedule) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (id: string, data: Partial<IndividualWorkingDays>) => Promise<void>
}

function defaultDraft(): DraftSchedule {
  return { working_days: [1, 2, 3, 4, 5], valid_from: '', valid_to: '' }
}

export default function IndividualScheduleBuilder({ schedules, onAdd, onDelete, onUpdate }: Props) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<DraftSchedule>(defaultDraft())
  const [saving, setSaving] = useState(false)

  async function submitDraft() {
    setSaving(true)
    try {
      await onAdd(draft)
      setDraft(defaultDraft())
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {schedules.map((s) => (
        <div key={s.id} className="border border-[#E2E8F0] rounded-[10px] p-4 bg-[#F8FAFC]">
          <div className="flex items-start justify-between mb-3">
            <div className="text-xs text-[#475569]">
              {s.valid_from
                ? `${new Date(s.valid_from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} → ${s.valid_to ? new Date(s.valid_to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'ongoing'}`
                : 'No date range set'}
            </div>
            <button
              type="button"
              onClick={() => onDelete(s.id)}
              className="p-1.5 rounded-[6px] hover:bg-[#FEE2E2] text-[#DC2626] transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <WorkingDaysToggle
            value={s.working_days}
            onChange={(days) => onUpdate(s.id, { working_days: days })}
          />
        </div>
      ))}

      {adding ? (
        <div className="border border-[#E2E8F0] rounded-[10px] p-4 bg-[#F8FAFC] space-y-3">
          <p className="text-sm font-semibold text-[#0F172A]">New Schedule</p>
          <WorkingDaysToggle value={draft.working_days} onChange={(d) => setDraft((f) => ({ ...f, working_days: d }))} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Valid from</label>
              <input
                type="date"
                value={draft.valid_from}
                onChange={(e) => setDraft((f) => ({ ...f, valid_from: e.target.value }))}
                className="w-full h-9 px-3 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] bg-white focus:border-[#2563EB] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Valid to</label>
              <input
                type="date"
                value={draft.valid_to}
                onChange={(e) => setDraft((f) => ({ ...f, valid_to: e.target.value }))}
                className="w-full h-9 px-3 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] bg-white focus:border-[#2563EB] outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setAdding(false); setDraft(defaultDraft()) }}
              className="h-9 px-4 rounded-[8px] border-2 border-[#2563EB] text-sm font-semibold text-[#2563EB] bg-white hover:bg-[#EFF6FF] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={submitDraft}
              className="h-9 px-4 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
            >
              {saving ? 'Saving...' : 'Add Schedule'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
        >
          <Plus size={15} />
          Add working schedule
        </button>
      )}
    </div>
  )
}
