'use client'

import { useEffect, useMemo, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import DatePicker from '@/components/ui/DatePicker'
import TimeField from '@/components/ui/TimeField'
import { useToast } from '@/components/ui/Toast'
import { meetingsApi, type CreateRhythmInput } from '@/lib/api/meetings'
import type { MeetingRhythm, MeetingType, RecurringScheduleType, RecurringEndCondition } from '@/lib/types/meetings'
import MeetingAttendeeSelector, { type PersonOption } from './MeetingAttendeeSelector'

const inputClass =
  'w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
const labelClass = 'block text-sm font-medium text-[#374151] mb-1'
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const todayStr = () => new Date().toISOString().slice(0, 10)

interface Props {
  isOpen: boolean
  onClose: () => void
  orgId: string
  people: PersonOption[]
  onCreated: (r: MeetingRhythm) => void
}

export default function CreateRhythmModal({ isOpen, onClose, orgId, people, onCreated }: Props) {
  const { addToast } = useToast()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<MeetingType>('online')
  const [onlineLink, setOnlineLink] = useState('')
  const [location, setLocation] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])
  const [optional, setOptional] = useState<string[]>([])
  const [agenda, setAgenda] = useState('')
  const [durationMin, setDurationMin] = useState(30)

  const [scheduleType, setScheduleType] = useState<RecurringScheduleType>('weekly')
  const [every, setEvery] = useState(1)
  const [days, setDays] = useState<number[]>([new Date().getDay()])
  const [monthDay, setMonthDay] = useState(1)
  const [yearlyMonth, setYearlyMonth] = useState(1)
  const [yearlyDay, setYearlyDay] = useState(1)
  const [time, setTime] = useState('10:00')
  const [startDate, setStartDate] = useState(todayStr())
  const [endCondition, setEndCondition] = useState<RecurringEndCondition>('never')
  const [endDate, setEndDate] = useState('')
  const [endAfter, setEndAfter] = useState(10)

  const [saving, setSaving] = useState(false)
  const nameOf = useMemo(() => new Map(people.map((p) => [p.user_id, p.name])), [people])

  useEffect(() => {
    if (!isOpen) return
    setTitle(''); setType('online'); setOnlineLink(''); setLocation(''); setAttendees([]); setOptional([]); setAgenda(''); setDurationMin(30)
    setScheduleType('weekly'); setEvery(1); setDays([new Date().getDay()]); setMonthDay(1); setYearlyMonth(1); setYearlyDay(1)
    setTime('10:00'); setStartDate(todayStr()); setEndCondition('never'); setEndDate(''); setEndAfter(10)
  }, [isOpen])

  useEffect(() => { setOptional((opt) => opt.filter((id) => attendees.includes(id))) }, [attendees])

  function toggleDay(d: number) { setDays((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d])) }
  function toggleOptional(id: string) { setOptional((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id])) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return addToast('Title is required', 'error')
    if (scheduleType === 'weekly' && days.length === 0) return addToast('Pick at least one weekday', 'error')
    if (!startDate) return addToast('Pick a start date', 'error')

    const dto: CreateRhythmInput = {
      title: title.trim(),
      type,
      duration_min: durationMin,
      attendee_user_ids: attendees,
      optional_user_ids: optional,
      schedule: {
        schedule_type: scheduleType,
        every: scheduleType === 'daily' || scheduleType === 'weekly' ? every : 1,
        days: scheduleType === 'weekly' ? days : [],
        month_days: scheduleType === 'monthly' ? [monthDay] : [],
        yearly_dates: scheduleType === 'yearly' ? [{ month: yearlyMonth, day: yearlyDay }] : [],
        time,
        start_date: new Date(`${startDate}T00:00`).toISOString(),
        end_condition: endCondition,
        end_date: endCondition === 'on_date' && endDate ? new Date(`${endDate}T23:59`).toISOString() : undefined,
        end_after: endCondition === 'after_n' ? endAfter : undefined,
      },
    }
    if (type !== 'offline' && onlineLink) dto.online_link = onlineLink
    if (type !== 'online') dto.location = location
    if (agenda.trim()) dto.agenda = agenda.trim()

    setSaving(true)
    try {
      const r = await meetingsApi.createRhythm(orgId, dto)
      addToast('Rhythm created', 'success')
      onCreated(r)
      onClose()
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to create rhythm', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Rhythm" size="lg" closeOnEscape={false}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>Title *</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Daily huddle, Thursday review" autoFocus />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Type</label>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as MeetingType)}>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Duration (min)</label>
            <input type="number" min={5} step={5} className={inputClass} value={durationMin} onChange={(e) => setDurationMin(Math.max(5, Number(e.target.value)))} />
          </div>
          {type !== 'offline' && (
            <div>
              <label className={labelClass}>Meeting link</label>
              <input className={inputClass} value={onlineLink} onChange={(e) => setOnlineLink(e.target.value)} placeholder="https://…" />
            </div>
          )}
          {type !== 'online' && (
            <div>
              <label className={labelClass}>Location</label>
              <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room / address" />
            </div>
          )}
        </div>

        {/* Attendees */}
        <div>
          <label className={labelClass}>Attendees</label>
          <MeetingAttendeeSelector options={people} value={attendees} onChange={setAttendees} />
          <p className="text-xs text-[#64748B] mt-1">Everyone is on every occurrence by default. Toggle who is optional.</p>
          {attendees.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {attendees.map((id) => {
                const isOpt = optional.includes(id)
                return (
                  <button key={id} type="button" onClick={() => toggleOptional(id)} className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border"
                    style={isOpt ? { backgroundColor: '#F1F5F9', color: '#475569', borderColor: '#E2E8F0' } : { backgroundColor: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' }}>
                    {nameOf.get(id) ?? 'Unknown'} · {isOpt ? 'Optional' : 'Required'}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Recurrence */}
        <div className="border border-[#E2E8F0] rounded-[12px] p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['daily', 'weekly', 'monthly', 'yearly'] as RecurringScheduleType[]).map((t) => (
              <button key={t} type="button" onClick={() => setScheduleType(t)}
                className={['px-3 py-1.5 text-sm font-medium rounded-[8px] border capitalize', scheduleType === t ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#475569] border-[#E2E8F0]'].join(' ')}>
                {t}
              </button>
            ))}
          </div>

          {(scheduleType === 'daily' || scheduleType === 'weekly') && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#475569]">Every</span>
              <input type="number" min={1} className={`${inputClass} w-20`} value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value)))} />
              <span className="text-sm text-[#475569]">{scheduleType === 'daily' ? 'day(s)' : 'week(s)'}</span>
            </div>
          )}

          {scheduleType === 'weekly' && (
            <div className="flex flex-wrap gap-1.5">
              {DOW.map((d, i) => (
                <button key={i} type="button" onClick={() => toggleDay(i)}
                  className={['w-11 h-9 text-sm font-medium rounded-[8px] border', days.includes(i) ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#475569] border-[#E2E8F0]'].join(' ')}>
                  {d}
                </button>
              ))}
            </div>
          )}

          {scheduleType === 'monthly' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#475569]">On day</span>
              <input type="number" min={1} max={31} className={`${inputClass} w-20`} value={monthDay} onChange={(e) => setMonthDay(Math.min(31, Math.max(1, Number(e.target.value))))} />
              <span className="text-sm text-[#475569]">of the month</span>
            </div>
          )}

          {scheduleType === 'yearly' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#475569]">On</span>
              <select className={`${inputClass} w-32`} value={yearlyMonth} onChange={(e) => setYearlyMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
                  <option key={mo} value={mo}>{new Date(2000, mo - 1, 1).toLocaleString(undefined, { month: 'long' })}</option>
                ))}
              </select>
              <input type="number" min={1} max={31} className={`${inputClass} w-20`} value={yearlyDay} onChange={(e) => setYearlyDay(Math.min(31, Math.max(1, Number(e.target.value))))} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Time</label>
              <TimeField value={time} onChange={setTime} />
            </div>
            <div>
              <label className={labelClass}>Starts</label>
              <DatePicker value={startDate} onChange={setStartDate} min={todayStr()} placeholder="Start date" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Ends</label>
            <div className="flex flex-wrap items-center gap-2">
              <select className={`${inputClass} w-40`} value={endCondition} onChange={(e) => setEndCondition(e.target.value as RecurringEndCondition)}>
                <option value="never">Never</option>
                <option value="on_date">On a date</option>
                <option value="after_n">After N times</option>
              </select>
              {endCondition === 'on_date' && <div className="w-44"><DatePicker value={endDate} onChange={setEndDate} min={startDate} placeholder="End date" /></div>}
              {endCondition === 'after_n' && (
                <div className="flex items-center gap-2">
                  <input type="number" min={1} className={`${inputClass} w-24`} value={endAfter} onChange={(e) => setEndAfter(Math.max(1, Number(e.target.value)))} />
                  <span className="text-sm text-[#475569]">occurrences</span>
                </div>
              )}
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">Occurrences on a holiday are skipped (never moved to a working day) and don’t count toward the limit.</p>
          </div>
        </div>

        <div>
          <label className={labelClass}>Agenda (optional)</label>
          <textarea className={`${inputClass} resize-none`} rows={2} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="Standing agenda, copied to every occurrence" />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" isLoading={saving} disabled={saving}>Create rhythm</Button>
        </div>
      </form>
    </Modal>
  )
}
