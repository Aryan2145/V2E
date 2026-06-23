'use client'

import { useState } from 'react'
import { Pencil, Trash2, RefreshCw, Check, X } from 'lucide-react'
import type { CalendarHoliday, HolidayType } from '@/lib/types/holidays'
import { parseLocalDate, dateOnly } from '@/lib/date'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

const TYPE_COLORS: Record<HolidayType, string> = {
  national: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
  company: 'bg-[#F3E8FF] text-[#7C3AED] border-[#E9D5FF]',
  regional: 'bg-[#FEF9C3] text-[#CA8A04] border-[#FDE68A]',
  team: 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]',
  personal: 'bg-[#FFE4E6] text-[#BE123C] border-[#FECDD3]',
  leave: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]',
}

function typeLabel(t: HolidayType): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}

interface EditState {
  id: string
  name: string
  date: string
}

interface Props {
  holidays: CalendarHoliday[]
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: { name?: string; date?: string }) => void
  emptyText?: string
}

/**
 * Org-calendar holiday list. Each row leads with a small date chip — the weekday
 * stacked over the day/month (e.g. "MON / 26 Jan") — then the name, a type tag, and
 * bare pencil/trash actions.
 */
export default function OrgHolidayList({ holidays, onDelete, onUpdate, emptyText = 'No holidays added.' }: Props) {
  const [editing, setEditing] = useState<EditState | null>(null)
  const [toDelete, setToDelete] = useState<CalendarHoliday | null>(null)
  const [deleting, setDeleting] = useState(false)

  function startEdit(h: CalendarHoliday) {
    setEditing({ id: h.id, name: h.name, date: dateOnly(h.date) })
  }

  async function saveEdit() {
    if (!editing) return
    await onUpdate(editing.id, { name: editing.name, date: editing.date })
    setEditing(null)
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await onDelete(toDelete.id)
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  if (holidays.length === 0) {
    return <p className="text-sm text-[#94A3B8] py-6 text-center">{emptyText}</p>
  }

  return (
    <>
    <div className="divide-y divide-[#E2E8F0]">
      {holidays.map((h) => {
        const isEditing = editing?.id === h.id
        const d = parseLocalDate(h.date)
        const weekday = d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()
        const dayMonth = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        const isRange = !!h.end_date && dateOnly(h.end_date) !== dateOnly(h.date)
        const endDayMonth = h.end_date ? parseLocalDate(h.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''

        if (isEditing) {
          return (
            <div key={h.id} className="flex items-center gap-3 py-3 px-1">
              <input
                value={editing.date}
                type="date"
                onChange={(e) => setEditing((s) => s ? { ...s, date: e.target.value } : s)}
                className="w-36 h-8 px-2 rounded-[6px] border border-[#CBD5E1] text-sm text-[#0F172A] bg-white focus:border-[#2563EB] outline-none"
              />
              <input
                value={editing.name}
                onChange={(e) => setEditing((s) => s ? { ...s, name: e.target.value } : s)}
                className="flex-1 h-8 px-2 rounded-[6px] border border-[#CBD5E1] text-sm text-[#0F172A] bg-white focus:border-[#2563EB] outline-none"
              />
              <button
                type="button"
                onClick={saveEdit}
                className="p-1.5 rounded-[6px] bg-[#DCFCE7] text-[#16A34A] hover:bg-[#BBF7D0] transition-colors"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-[6px] bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )
        }

        return (
          <div
            key={h.id}
            className="group flex items-center gap-3 py-2.5 px-1 rounded-[8px] hover:bg-[#F8FAFC] transition-colors"
          >
            {/* Date chip — weekday over day/month (start date) */}
            <div className="shrink-0 w-14 flex flex-col items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] py-1">
              <span className="text-[10px] font-semibold tracking-wide text-[#94A3B8] leading-tight">{weekday}</span>
              <span className="text-[13px] font-semibold text-[#0F172A] leading-tight">{dayMonth}</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0F172A] truncate">{h.name}</p>
              {isRange && (
                <p className="text-xs text-[#94A3B8] truncate">{dayMonth} – {endDayMonth}</p>
              )}
            </div>

            <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[h.type]}`}>
              {typeLabel(h.type)}
            </span>
            {h.status === 'pending_review' && (
              <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-[#FEF9C3] text-[#CA8A04] border-[#FDE68A]">
                pending
              </span>
            )}
            {h.is_recurring_yearly && (
              <span title="Repeats yearly" className="shrink-0">
                <RefreshCw size={13} className="text-[#94A3B8]" />
              </span>
            )}

            <button
              type="button"
              onClick={() => startEdit(h)}
              className="p-1.5 rounded-[6px] hover:bg-[#EFF6FF] text-[#475569] hover:text-[#2563EB] transition-colors shrink-0"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => setToDelete(h)}
              className="p-1.5 rounded-[6px] hover:bg-[#FEE2E2] text-[#475569] hover:text-[#DC2626] transition-colors shrink-0"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )
      })}
    </div>

    {/* Delete confirmation */}
    <Modal
      isOpen={!!toDelete}
      onClose={() => !deleting && setToDelete(null)}
      title="Delete holiday"
      size="sm"
    >
      <p className="text-sm text-[#1E293B]">
        Delete <span className="font-semibold">{toDelete?.name}</span>? This can&apos;t be undone.
      </p>
      <div className="flex items-center justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</Button>
        <Button variant="danger" onClick={confirmDelete} isLoading={deleting} disabled={deleting}>Delete</Button>
      </div>
    </Modal>
    </>
  )
}
