'use client'

import React from 'react'
import { X, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import DatePicker from '@/components/ui/DatePicker'
import TimeField from '@/components/ui/TimeField'
import type { ReminderSpec, ReminderRecipient } from '@/lib/types/tasks'

// A reminder being edited in a task/recurring form. The assignee is always
// notified; the assigner / CC toggles add extra recipients.
export interface ReminderRow {
  key: string
  kind: 'relative' | 'absolute'
  offsetDays: number // relative: days before deadline
  date: string // absolute: yyyy-mm-dd
  time: string // HH:mm — fire time (relative) / time on the date (absolute)
  toAssigner: boolean
  toCc: boolean
}

let reminderSeq = 0
export function makeReminderRow(partial?: Partial<ReminderRow>): ReminderRow {
  return {
    key: `r${(reminderSeq += 1)}`,
    kind: 'relative',
    offsetDays: 1,
    date: '',
    time: '09:00',
    toAssigner: false,
    toCc: false,
    ...partial,
  }
}

// Short read-only label for a reminder, shown in the collapsed summary.
export function reminderLabel(r: ReminderRow): string {
  const extra = [r.toAssigner && 'assigner', r.toCc && 'CC'].filter(Boolean).join(' + ')
  const who = extra ? ` → +${extra}` : ''
  if (r.kind === 'relative') {
    const d = r.offsetDays === 0 ? 'On the day' : `${r.offsetDays} day${r.offsetDays !== 1 ? 's' : ''} before`
    return `${d} · ${r.time || '09:00'}${who}`
  }
  const date = r.date ? new Date(`${r.date}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : 'no date'
  return `On ${date} · ${r.time || '09:00'}${who}`
}

// Convert the rows into ReminderSpecs for the API. For one-time tasks
// (resolveRelative), relative reminders are precomputed to an absolute instant in
// the user's local timezone; for recurring templates they stay relative so each
// spawned instance recomputes against its own deadline.
export function buildReminderSpecs(
  rows: ReminderRow[],
  resolveRelative: boolean,
  deadlineDate?: string,
): ReminderSpec[] {
  return rows.flatMap((r) => {
    const recipients: ReminderRecipient[] = [
      'assignee',
      ...(r.toAssigner ? (['assigner'] as const) : []),
      ...(r.toCc ? (['cc'] as const) : []),
    ]
    if (r.kind === 'relative') {
      const spec: ReminderSpec = { kind: 'relative', offset_days: r.offsetDays, time: r.time || '09:00', recipients }
      if (resolveRelative && deadlineDate) {
        const d = new Date(`${deadlineDate}T${r.time || '09:00'}`)
        d.setDate(d.getDate() - r.offsetDays)
        spec.remind_at = d.toISOString()
      }
      return [spec]
    }
    if (!r.date) return []
    return [{ kind: 'absolute', remind_at: new Date(`${r.date}T${r.time || '09:00'}`).toISOString(), recipients }]
  })
}

// Rebuild editable rows from stored specs (edit-recurring prefill).
export function rowsFromReminderSpecs(specs: ReminderSpec[] | undefined | null): ReminderRow[] {
  if (!Array.isArray(specs)) return []
  return specs.map((s) => {
    const recipients = s.recipients ?? []
    if (s.kind === 'relative') {
      return makeReminderRow({
        kind: 'relative',
        offsetDays: s.offset_days ?? 1,
        time: s.time || '09:00',
        toAssigner: recipients.includes('assigner'),
        toCc: recipients.includes('cc'),
      })
    }
    const at = s.remind_at ? new Date(s.remind_at) : null
    return makeReminderRow({
      kind: 'absolute',
      date: at ? `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}` : '',
      time: at ? `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` : '09:00',
      toAssigner: recipients.includes('assigner'),
      toCc: recipients.includes('cc'),
    })
  })
}

// The absolute moment a reminder would fire (given a one-time deadline date).
function reminderInstant(r: ReminderRow, deadlineDate?: string): Date | null {
  if (r.kind === 'relative') {
    if (!deadlineDate) return null
    const d = new Date(`${deadlineDate}T${r.time || '09:00'}`)
    d.setDate(d.getDate() - r.offsetDays)
    return d
  }
  return r.date ? new Date(`${r.date}T${r.time || '09:00'}`) : null
}

/**
 * Reminders must fall between now and the deadline. One-time mode only —
 * recurring recomputes per instance. Returns an error string, or null if valid.
 */
export function validateRemindersAgainstDeadline(
  rows: ReminderRow[],
  deadlineISO: string | null,
  deadlineDate?: string,
): string | null {
  if (rows.some((r) => r.kind === 'absolute' && !r.date)) return 'Pick a date for each “on a date” reminder.'
  const now = new Date()
  const deadlineInstant = deadlineISO ? new Date(deadlineISO) : null
  for (const r of rows) {
    const at = reminderInstant(r, deadlineDate)
    if (!at) continue
    if (at.getTime() <= now.getTime()) return `A reminder (${reminderLabel(r)}) falls in the past. Reminders must be after now.`
    if (deadlineInstant && at.getTime() > deadlineInstant.getTime()) {
      return `A reminder (${reminderLabel(r)}) is after the deadline. Reminders must be on or before the due date.`
    }
  }
  return null
}

interface Props {
  reminders: ReminderRow[]
  onChange: (rows: ReminderRow[]) => void
  /** 'one_time' gates on a deadline and shows fire-date hints; 'recurring' is always available. */
  mode: 'one_time' | 'recurring'
  /** Selected one-time deadline date (yyyy-mm-dd) — drives hints and the date cap. */
  deadlineDate?: string
  todayStr: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Collapsible "Reminders" card shared by the Create Task modal (both modes) and
 * the Edit Recurring modal. Collapsed it shows a read-only summary; expanded it
 * edits multiple relative/absolute reminder rows with recipient toggles.
 */
export default function RemindersField({ reminders, onChange, mode, deadlineDate, todayStr, open, onOpenChange }: Props) {
  const [gate, setGate] = React.useState<string | null>(null)
  const available = mode === 'recurring' || !!deadlineDate

  // The gate clears itself once reminders become available (deadline set / recurring).
  React.useEffect(() => {
    if (available) setGate(null)
  }, [available])

  function update(key: string, patch: Partial<ReminderRow>) {
    onChange(reminders.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  function remove(key: string) {
    onChange(reminders.filter((r) => r.key !== key))
  }
  function add() {
    onChange([...reminders, makeReminderRow()])
  }

  return (
    <div>
      <div className="rounded-[12px] border border-[#E2E8F0] bg-white overflow-visible">
        {/* Header — click to expand/collapse; collapsed shows a read-only summary */}
        <button
          type="button"
          onClick={() => {
            if (!available) {
              setGate('Please select a deadline first, then set reminders.')
              return
            }
            setGate(null)
            onOpenChange(!open)
          }}
          aria-expanded={open}
          className="w-full flex items-center gap-2 px-3 py-3 text-left hover:bg-[#F8FAFC] transition-colors"
        >
          <label className="text-sm font-medium text-[#374151] cursor-pointer shrink-0">Reminders</label>
          <span className="text-xs font-normal text-[#475569] shrink-0">Optional</span>
          {available && reminders.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#2563EB] text-white text-[11px] font-semibold shrink-0">
              {reminders.length}
            </span>
          )}
          {!open && available && (
            <span className="min-w-0 flex-1 truncate text-xs text-[#475569]">
              {reminders.length === 0
                ? 'None'
                : reminders.length === 1
                  ? reminderLabel(reminders[0])
                  : `${reminderLabel(reminders[0])}  ·  +${reminders.length - 1} more`}
            </span>
          )}
          <span className="ml-auto flex items-center justify-center w-6 h-6 rounded-[6px] text-[#2563EB] shrink-0" aria-hidden>
            {available && reminders.length > 0 ? (
              open ? <ChevronUp size={16} /> : <ChevronDown size={16} />
            ) : (
              <Plus size={18} className={open ? 'rotate-45 transition-transform' : 'transition-transform'} />
            )}
          </span>
        </button>
        {open && (
          <div className="px-3 pb-3 pt-0 space-y-2 max-h-[340px] overflow-y-auto">
            {reminders.length === 0 ? (
              <p className="text-xs text-[#475569] px-1 py-2">No reminders — the assignee won’t be nudged before the deadline.</p>
            ) : (
              reminders.map((r) => {
                let hint: string | null = null
                if (r.kind === 'relative' && mode === 'one_time' && deadlineDate) {
                  const d = new Date(`${deadlineDate}T00:00`)
                  d.setDate(d.getDate() - r.offsetDays)
                  hint = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                }
                return (
                  <div key={r.key} className="relative rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2.5">
                    {/* remove — top-right corner */}
                    <button
                      type="button"
                      onClick={() => remove(r.key)}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#DC2626] hover:bg-white transition-colors"
                      aria-label="Remove reminder"
                    >
                      <X size={14} />
                    </button>

                    {/* kind toggle — full width, with room reserved for the corner X */}
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-[8px] bg-[#F1F5F9] border border-[#E2E8F0] mr-7">
                      {([
                        { k: 'relative' as const, label: 'Days before' },
                        { k: 'absolute' as const, label: 'On a date' },
                      ]).map(({ k, label }) => {
                        const active = r.kind === k
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => update(r.key, { kind: k })}
                            className={[
                              'px-2 py-1.5 rounded-[6px] text-xs font-medium transition-colors',
                              active ? 'bg-[#2563EB] text-white' : 'text-[#475569] hover:bg-white',
                            ].join(' ')}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>

                    {/* timing + recipients on one line (wraps only when too narrow) */}
                    <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
                      {r.kind === 'relative' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={r.offsetDays}
                            onChange={(e) => update(r.key, { offsetDays: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-11 text-center border border-[#CBD5E1] rounded-[8px] px-2 py-1.5 text-[13px] text-[#0F172A] bg-[#F8FAFC] hover:bg-white hover:border-[#94A3B8] focus:bg-white focus:border-2 focus:border-[#2563EB] focus:outline-none"
                          />
                          <span className="text-[13px] text-[#475569]">days before</span>
                          <div className="w-[104px]">
                            <TimeField value={r.time} onChange={(v) => update(r.key, { time: v })} label="Reminder time" compact />
                          </div>
                          {hint && <span className="text-xs font-medium text-[#2563EB]">→ {hint}</span>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-[140px]">
                            <DatePicker
                              value={r.date}
                              onChange={(v) => update(r.key, { date: v })}
                              min={todayStr}
                              max={mode === 'one_time' && deadlineDate ? deadlineDate : '2100-12-31'}
                              placeholder="Pick date"
                              compact
                            />
                          </div>
                          <div className="w-[104px]">
                            <TimeField value={r.time} onChange={(v) => update(r.key, { time: v })} label="Reminder time" compact />
                          </div>
                        </div>
                      )}

                      {/* recipients — sit at the right of the same row, wrap under if tight */}
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-xs text-[#475569]">Notify:</span>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#2563EB] text-white">Assignee</span>
                        <button
                          type="button"
                          onClick={() => update(r.key, { toAssigner: !r.toAssigner })}
                          className={[
                            'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                            r.toAssigner ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#94A3B8]',
                          ].join(' ')}
                        >
                          Assigner
                        </button>
                        <button
                          type="button"
                          onClick={() => update(r.key, { toCc: !r.toCc })}
                          className={[
                            'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                            r.toCc ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#94A3B8]',
                          ].join(' ')}
                        >
                          CC
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <button
              type="button"
              onClick={add}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-sm font-medium text-[#2563EB] border border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors"
            >
              <Plus size={14} /> Add reminder
            </button>
          </div>
        )}
      </div>
      {gate && <p className="mt-1.5 text-xs text-[#DC2626]">{gate}</p>}
    </div>
  )
}
