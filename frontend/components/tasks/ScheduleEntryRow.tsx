'use client'

import React from 'react'
import { X } from 'lucide-react'
import type { RecurringScheduleType, RecurringEndCondition, YearlyDate } from '@/lib/types/tasks'
import DatePicker from '@/components/ui/DatePicker'
import TimeField from '@/components/ui/TimeField'

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TYPES: { value: RecurringScheduleType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export interface ScheduleEntryDraft {
  schedule_type: RecurringScheduleType
  every: number
  days: number[]
  month_days: number[]
  yearly_dates: YearlyDate[]
  time: string
  start_date: string
  end_condition: RecurringEndCondition
  end_date: string
  end_after: number
}

interface Props {
  entry: ScheduleEntryDraft
  index: number
  onUpdate: (patch: Partial<ScheduleEntryDraft>) => void
  onDelete: () => void
  canDelete: boolean
}

const inputCls = 'border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] bg-white focus:border-2 focus:border-[#2563EB] focus:outline-none'
const labelCls = 'text-sm font-medium text-[#374151]'

export default function ScheduleEntryRow({ entry, index, onUpdate, onDelete, canDelete }: Props) {
  function toggleDow(d: number) {
    const next = entry.days.includes(d) ? entry.days.filter((x) => x !== d) : [...entry.days, d]
    onUpdate({ days: next })
  }

  function toggleMonthDay(d: number) {
    const next = entry.month_days.includes(d) ? entry.month_days.filter((x) => x !== d) : [...entry.month_days, d]
    onUpdate({ month_days: next })
  }

  function addYearlyDate() {
    onUpdate({ yearly_dates: [...entry.yearly_dates, { month: 1, day: 1 }] })
  }

  function updateYearlyDate(i: number, patch: Partial<YearlyDate>) {
    const next = entry.yearly_dates.map((d, idx) => idx === i ? { ...d, ...patch } : d)
    onUpdate({ yearly_dates: next })
  }

  function removeYearlyDate(i: number) {
    onUpdate({ yearly_dates: entry.yearly_dates.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Entry #{index + 1}</span>
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          title={canDelete ? 'Remove entry' : 'Cannot remove last entry'}
          className={[
            'w-7 h-7 rounded-[6px] flex items-center justify-center transition-colors',
            canDelete
              ? 'text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2]'
              : 'text-[#CBD5E1] cursor-not-allowed',
          ].join(' ')}
        >
          <X size={14} />
        </button>
      </div>

      {/* Type tabs */}
      <div>
        <label className={`${labelCls} block mb-2`}>Repeat</label>
        <div className="flex items-center border border-[#E2E8F0] rounded-[8px] p-0.5 gap-0.5">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onUpdate({ schedule_type: t.value })}
              className={[
                'flex-1 py-1.5 text-sm font-medium rounded-[6px] transition-colors',
                entry.schedule_type === t.value
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#475569] hover:bg-[#F1F5F9]',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Daily config */}
      {entry.schedule_type === 'daily' && (
        <div className="flex items-center gap-3">
          <span className={labelCls}>Every</span>
          <input
            type="number"
            min={1}
            max={365}
            value={entry.every}
            onChange={(e) => onUpdate({ every: Math.max(1, Number(e.target.value)) })}
            className={`w-20 text-center ${inputCls}`}
          />
          <span className="text-sm text-[#475569]">day{entry.every !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Weekly config */}
      {entry.schedule_type === 'weekly' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={labelCls}>Every</span>
            <input
              type="number"
              min={1}
              max={52}
              value={entry.every}
              onChange={(e) => onUpdate({ every: Math.max(1, Number(e.target.value)) })}
              className={`w-20 text-center ${inputCls}`}
            />
            <span className="text-sm text-[#475569]">week{entry.every !== 1 ? 's' : ''} on</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {DOW_LABELS.map((label, d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDow(d)}
                className={[
                  'px-3 py-1.5 text-sm font-medium rounded-[8px] border transition-colors',
                  entry.days.includes(d)
                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                    : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#2563EB] hover:text-[#2563EB]',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly config */}
      {entry.schedule_type === 'monthly' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={labelCls}>Every</span>
            <input
              type="number"
              min={1}
              max={12}
              value={entry.every}
              onChange={(e) => onUpdate({ every: Math.max(1, Number(e.target.value)) })}
              className={`w-20 text-center ${inputCls}`}
            />
            <span className="text-sm text-[#475569]">month{entry.every !== 1 ? 's' : ''} on day(s)</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleMonthDay(d)}
                className={[
                  'h-8 w-full text-xs font-medium rounded-[6px] border transition-colors',
                  entry.month_days.includes(d)
                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                    : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#2563EB] hover:text-[#2563EB]',
                ].join(' ')}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Yearly config */}
      {entry.schedule_type === 'yearly' && (
        <div className="space-y-2">
          <label className={`${labelCls} block`}>On date(s) each year</label>
          {entry.yearly_dates.map((yd, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={yd.month}
                onChange={(e) => updateYearlyDate(i, { month: Number(e.target.value) })}
                className={`flex-1 ${inputCls}`}
              >
                {MONTH_LABELS.map((m, mi) => (
                  <option key={mi} value={mi + 1}>{m}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={31}
                value={yd.day}
                onChange={(e) => updateYearlyDate(i, { day: Math.min(31, Math.max(1, Number(e.target.value))) })}
                className={`w-20 text-center ${inputCls}`}
              />
              {entry.yearly_dates.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeYearlyDate(i)}
                  className="text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addYearlyDate}
            className="text-sm text-[#2563EB] hover:underline font-medium"
          >
            + Add date
          </button>
        </div>
      )}

      {/* Time + Start date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={`${labelCls} block mb-1.5`}>Time</label>
          <div className="w-full">
            <TimeField value={entry.time} onChange={(v) => onUpdate({ time: v })} />
          </div>
        </div>
        <div>
          <label className={`${labelCls} block mb-1.5`}>Starting</label>
          <DatePicker
            value={entry.start_date}
            onChange={(iso) => onUpdate({ start_date: iso })}
            placeholder="Select date"
          />
        </div>
      </div>

      {/* End condition */}
      <div>
        <label className={`${labelCls} block mb-1.5`}>Ends</label>
        <div className="flex items-center border border-[#E2E8F0] rounded-[8px] p-0.5 gap-0.5 mb-3">
          {(['never', 'on_date', 'after_n'] as RecurringEndCondition[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onUpdate({ end_condition: v })}
              className={[
                'flex-1 py-1.5 text-sm font-medium rounded-[6px] transition-colors',
                entry.end_condition === v
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#475569] hover:bg-[#F1F5F9]',
              ].join(' ')}
            >
              {v === 'never' ? 'Never' : v === 'on_date' ? 'On date' : 'After N'}
            </button>
          ))}
        </div>
        {entry.end_condition === 'on_date' && (
          <DatePicker
            value={entry.end_date}
            onChange={(iso) => onUpdate({ end_date: iso })}
            placeholder="Select date"
          />
        )}
        {entry.end_condition === 'after_n' && (
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              value={entry.end_after}
              onChange={(e) => onUpdate({ end_after: Math.max(1, Number(e.target.value)) })}
              className={`w-24 text-center ${inputCls}`}
            />
            <span className="text-sm text-[#475569]">occurrences</span>
          </div>
        )}
      </div>
    </div>
  )
}
