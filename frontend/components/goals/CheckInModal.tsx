'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import DatePicker from '@/components/ui/DatePicker'
import { useToast } from '@/components/ui/Toast'
import { goalsApi } from '@/lib/api/goals'
import {
  CONFIDENCE_META,
  type Goal,
  type GoalConfidence,
  type CreateCheckInInput,
} from '@/lib/types/goals'

const inputClass =
  'w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
const labelClass = 'block text-sm font-medium text-[#374151] mb-1'
const todayStr = () => new Date().toISOString().slice(0, 10)
const CONFIDENCES: GoalConfidence[] = ['on_track', 'at_risk', 'off_track']

interface Props {
  isOpen: boolean
  onClose: () => void
  orgId: string
  goal: Goal
  onSaved: () => void
}

export default function CheckInModal({ isOpen, onClose, orgId, goal, onSaved }: Props) {
  const { addToast } = useToast()
  const [date, setDate] = useState(todayStr())
  const [confidence, setConfidence] = useState<GoalConfidence>('on_track')
  const [note, setNote] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setDate(todayStr())
    setConfidence(goal.last_confidence ?? 'on_track')
    setNote('')
    // Pre-fill each measure with its last recorded actual so the owner edits deltas.
    const seed: Record<string, string> = {}
    for (const m of goal.measures ?? []) seed[m.id] = m.current_value ?? ''
    setValues(seed)
  }, [isOpen, goal])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) return addToast('Check-in date is required', 'error')

    const measureValues = (goal.measures ?? [])
      .map((m) => ({ goal_measure_id: m.id, value: (values[m.id] ?? '').trim() }))
      .filter((v) => v.value !== '')

    const dto: CreateCheckInInput = {
      check_in_date: new Date(date).toISOString(),
      confidence,
      status_note: note.trim() || undefined,
      values: measureValues.length ? measureValues : undefined,
    }

    setSaving(true)
    try {
      await goalsApi.createCheckIn(orgId, goal.id, dto)
      addToast('Check-in recorded', 'success')
      onSaved()
      onClose()
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to record check-in', 'error')
    } finally {
      setSaving(false)
    }
  }

  const measures = goal.measures ?? []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Check in — ${goal.title}`} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Date + confidence */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Check-in date *</label>
            <DatePicker value={date} onChange={setDate} max={todayStr()} placeholder="Select date" />
          </div>
          <div>
            <label className={labelClass}>Confidence *</label>
            <div className="grid grid-cols-3 gap-2">
              {CONFIDENCES.map((c) => {
                const m = CONFIDENCE_META[c]
                const active = confidence === c
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setConfidence(c)}
                    className={[
                      'flex items-center justify-center gap-1.5 px-2 py-2 rounded-[8px] border text-sm font-medium transition-colors',
                      active ? 'text-white' : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-[#CBD5E1]',
                    ].join(' ')}
                    style={active ? { backgroundColor: m.dot, borderColor: m.dot } : undefined}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: active ? '#FFFFFF' : m.dot }}
                    />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Measure actuals */}
        <div>
          <label className={labelClass}>Record actuals</label>
          {measures.length === 0 ? (
            <p className="text-xs text-[#94A3B8]">
              This goal has no measures — your confidence and note will still be logged.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {measures.map((m) => (
                <div key={m.id} className="flex items-center gap-3 border border-[#E2E8F0] rounded-[8px] px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{m.name}</p>
                    <p className="text-xs text-[#64748B]">
                      Target {m.target_value}
                      {m.unit ? ` ${m.unit}` : ''}
                      {m.current_value ? ` · was ${m.current_value}` : ''}
                    </p>
                  </div>
                  <input
                    className={`${inputClass} w-28 shrink-0`}
                    placeholder="Actual"
                    value={values[m.id] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
                  />
                  {m.unit ? <span className="text-sm text-[#64748B] w-10 shrink-0">{m.unit}</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Narrative */}
        <div>
          <label className={labelClass}>What&apos;s happening &amp; why</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="One or two sentences: the story behind the number, blockers, next step…"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={saving} disabled={saving}>
            Record check-in
          </Button>
        </div>
      </form>
    </Modal>
  )
}
