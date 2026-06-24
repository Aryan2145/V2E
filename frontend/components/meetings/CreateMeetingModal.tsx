'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import DatePicker from '@/components/ui/DatePicker'
import { useToast } from '@/components/ui/Toast'
import { meetingsApi, type CreateMeetingInput } from '@/lib/api/meetings'
import { goalsApi } from '@/lib/api/goals'
import type { Meeting, MeetingLinkType, MeetingMode, MeetingType } from '@/lib/types/meetings'
import MeetingAttendeeSelector, { type PersonOption } from './MeetingAttendeeSelector'

const inputClass =
  'w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
const labelClass = 'block text-sm font-medium text-[#374151] mb-1'

interface Props {
  isOpen: boolean
  onClose: () => void
  orgId: string
  people: PersonOption[]
  onCreated: (m: Meeting) => void
}

interface SlotRow {
  date: string
  start: string
  end: string
}

type CallMode = MeetingMode | 'log_past'

const todayStr = () => new Date().toISOString().slice(0, 10)
function toISO(date: string, time: string): string | undefined {
  if (!date) return undefined
  return new Date(`${date}T${time || '09:00'}`).toISOString()
}

export default function CreateMeetingModal({ isOpen, onClose, orgId, people, onCreated }: Props) {
  const { addToast } = useToast()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<MeetingType>('online')
  const [onlineLink, setOnlineLink] = useState('')
  const [onlinePassword, setOnlinePassword] = useState('')
  const [location, setLocation] = useState('')
  const [callMode, setCallMode] = useState<CallMode>('fixed')
  const [attendees, setAttendees] = useState<string[]>([])
  const [agenda, setAgenda] = useState('')
  const [minutes, setMinutes] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [linkType, setLinkType] = useState<'' | MeetingLinkType>('')
  const [linkEntityId, setLinkEntityId] = useState('')
  const [goals, setGoals] = useState<{ id: string; title: string }[]>([])

  // fixed
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('11:00')
  // poll
  const [windowStart, setWindowStart] = useState('')
  const [windowEnd, setWindowEnd] = useState('')
  const [durationMin, setDurationMin] = useState(60)
  const [slots, setSlots] = useState<SlotRow[]>([])
  // log past
  const [actualDate, setActualDate] = useState('')
  const [actualStart, setActualStart] = useState('10:00')
  const [actualEnd, setActualEnd] = useState('11:00')

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setTitle(''); setType('online'); setOnlineLink(''); setOnlinePassword(''); setLocation('')
    setCallMode('fixed'); setAttendees([]); setAgenda(''); setMinutes(''); setShowPassword(false); setLinkType(''); setLinkEntityId('')
    setDate(''); setStartTime('10:00'); setEndTime('11:00')
    setWindowStart(''); setWindowEnd(''); setDurationMin(60); setSlots([])
    setActualDate(''); setActualStart('10:00'); setActualEnd('11:00')
  }, [isOpen])

  useEffect(() => {
    if (linkType === 'goal' && goals.length === 0) {
      goalsApi.list(orgId).then((gs) => setGoals(gs.map((g) => ({ id: g.id, title: g.title })))).catch(() => {})
    }
  }, [linkType, orgId, goals.length])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return addToast('Title is required', 'error')

    const dto: CreateMeetingInput = {
      title: title.trim(),
      type,
      mode: callMode === 'log_past' ? 'fixed' : callMode,
      attendee_user_ids: attendees,
    }
    if (type !== 'offline') { if (onlineLink) dto.online_link = onlineLink; if (onlinePassword) dto.online_password = onlinePassword }
    if (type !== 'online') dto.location = location
    if (agenda.trim()) dto.agenda = agenda.trim()
    if (linkType) { dto.link_type = linkType; dto.link_entity_id = linkEntityId || undefined }

    if (callMode === 'fixed') {
      if (!date) return addToast('Pick a date', 'error')
      dto.scheduled_start = toISO(date, startTime)
      dto.scheduled_end = toISO(date, endTime)
    } else if (callMode === 'poll') {
      if (!windowStart || !windowEnd) return addToast('Set the poll window', 'error')
      dto.poll_window_start = toISO(windowStart, '00:00')
      dto.poll_window_end = toISO(windowEnd, '23:59')
      dto.poll_duration_min = durationMin
      dto.slots = slots
        .filter((s) => s.date)
        .map((s) => ({ start_at: toISO(s.date, s.start)!, end_at: toISO(s.date, s.end)! }))
    } else {
      // log past
      if (!actualDate) return addToast('Pick the date it happened', 'error')
      dto.log_past = true
      dto.actual_start = toISO(actualDate, actualStart)
      dto.actual_end = toISO(actualDate, actualEnd)
      if (minutes.trim()) dto.minutes = minutes.trim()
    }

    setSaving(true)
    try {
      const m = await meetingsApi.create(orgId, dto)
      addToast('Meeting created', 'success')
      onCreated(m)
      onClose()
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to create meeting', 'error')
    } finally {
      setSaving(false)
    }
  }

  const modeTab = (m: CallMode, label: string) => (
    <button
      type="button"
      onClick={() => setCallMode(m)}
      className={[
        'px-3 py-1.5 text-sm font-medium rounded-[8px] border transition-colors',
        callMode === m ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-[#CBD5E1]',
      ].join(' ')}
    >
      {label}
    </button>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Meeting" size="lg" closeOnEscape={false}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>Title *</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting title" autoFocus />
        </div>

        {/* Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Type</label>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as MeetingType)}>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          {type !== 'offline' && (
            <div>
              <label className={labelClass}>Meeting link</label>
              <input className={inputClass} value={onlineLink} onChange={(e) => setOnlineLink(e.target.value)} placeholder="https://…" />
            </div>
          )}
          {type !== 'offline' && (
            <div>
              <label className={labelClass}>Password (optional)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`${inputClass} pr-10`}
                  value={onlinePassword}
                  onChange={(e) => setOnlinePassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}
          {type !== 'online' && (
            <div>
              <label className={labelClass}>Location</label>
              <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room / address" />
            </div>
          )}
        </div>

        {/* Linkage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Link to</label>
            <select className={inputClass} value={linkType} onChange={(e) => { setLinkType(e.target.value as any); setLinkEntityId('') }}>
              <option value="">Ad-hoc (nothing)</option>
              <option value="goal">Goal</option>
              <option value="project">Project</option>
              <option value="task">Task</option>
              <option value="ticket">Ticket</option>
            </select>
          </div>
          {linkType === 'goal' && (
            <div>
              <label className={labelClass}>Goal</label>
              <select className={inputClass} value={linkEntityId} onChange={(e) => setLinkEntityId(e.target.value)}>
                <option value="">Select goal…</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>
          )}
          {linkType && linkType !== 'goal' && (
            <div>
              <label className={labelClass}>{linkType[0].toUpperCase() + linkType.slice(1)} ID</label>
              <input className={inputClass} value={linkEntityId} onChange={(e) => setLinkEntityId(e.target.value)} placeholder="Entity ID" />
            </div>
          )}
        </div>

        {/* Attendees */}
        <div>
          <label className={labelClass}>Attendees</label>
          <MeetingAttendeeSelector options={people} value={attendees} onChange={setAttendees} />
        </div>

        {/* Call mode */}
        <div>
          <label className={labelClass}>How to schedule</label>
          <div className="flex flex-wrap gap-2">
            {modeTab('fixed', 'Fixed time')}
            {modeTab('poll', 'Poll for a slot')}
            {modeTab('log_past', 'Log a past meeting')}
          </div>
        </div>

        {callMode === 'fixed' && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Date *</label>
              <DatePicker value={date} onChange={setDate} min={todayStr()} placeholder="Select date" />
            </div>
            <div>
              <label className={labelClass}>Start</label>
              <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>End</label>
              <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        )}

        {callMode === 'poll' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Window from *</label>
                <DatePicker value={windowStart} onChange={setWindowStart} min={todayStr()} placeholder="Select date" />
              </div>
              <div>
                <label className={labelClass}>Window to *</label>
                <DatePicker value={windowEnd} onChange={setWindowEnd} min={windowStart || todayStr()} placeholder="Select date" />
              </div>
              <div>
                <label className={labelClass}>Duration (min)</label>
                <input type="number" className={inputClass} value={durationMin} min={5} step={5} onChange={(e) => setDurationMin(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelClass + ' mb-0'}>Candidate slots</label>
                <button type="button" onClick={() => setSlots((s) => [...s, { date: '', start: '10:00', end: '11:00' }])} className="inline-flex items-center gap-1 text-sm font-medium text-[#2563EB]">
                  <Plus size={14} /> Add slot
                </button>
              </div>
              <p className="text-xs text-[#94A3B8] mb-2">Smart calendar-aware suggestions are added automatically too.</p>
              <div className="flex flex-col gap-2">
                {slots.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <DatePicker value={s.date} onChange={(iso) => setSlots((rows) => rows.map((r, idx) => idx === i ? { ...r, date: iso } : r))} placeholder="Select date" />
                    <input type="time" className={`${inputClass} w-28`} value={s.start} onChange={(e) => setSlots((rows) => rows.map((r, idx) => idx === i ? { ...r, start: e.target.value } : r))} />
                    <input type="time" className={`${inputClass} w-28`} value={s.end} onChange={(e) => setSlots((rows) => rows.map((r, idx) => idx === i ? { ...r, end: e.target.value } : r))} />
                    <button type="button" onClick={() => setSlots((rows) => rows.filter((_, idx) => idx !== i))} className="text-[#94A3B8] hover:text-[#DC2626]"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {callMode === 'log_past' && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Date *</label>
              <DatePicker value={actualDate} onChange={setActualDate} max={todayStr()} placeholder="Select date" />
            </div>
            <div>
              <label className={labelClass}>Started</label>
              <input type="time" className={inputClass} value={actualStart} onChange={(e) => setActualStart(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Ended</label>
              <input type="time" className={inputClass} value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} />
            </div>
            <div className="col-span-3">
              <label className={labelClass}>Minutes (what happened)</label>
              <textarea className={`${inputClass} resize-none`} rows={4} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Notes / decisions (markdown supported). The meeting will be filed as Closed — use Reopen to amend." />
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>{callMode === 'log_past' ? 'Agenda (what was planned)' : 'Agenda'}</label>
          <textarea className={`${inputClass} resize-none`} rows={3} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="Agenda (markdown supported)" />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" isLoading={saving} disabled={saving}>Create meeting</Button>
        </div>
      </form>
    </Modal>
  )
}
