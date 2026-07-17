'use client'

import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, CalendarSearch } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import DatePicker from '@/components/ui/DatePicker'
import TimeField from '@/components/ui/TimeField'
import { useToast } from '@/components/ui/Toast'
import { meetingsApi, type CreateMeetingInput } from '@/lib/api/meetings'
import { goalsApi } from '@/lib/api/goals'
import type { Meeting, MeetingLinkType, MeetingType } from '@/lib/types/meetings'
import MeetingAttendeeSelector, { type PersonOption } from './MeetingAttendeeSelector'
import BusyTimesPanel from './BusyTimesPanel'

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

type CallMode = 'fixed' | 'log_past'

const todayStr = () => new Date().toISOString().slice(0, 10)
function toISO(date: string, time: string): string | undefined {
  if (!date) return undefined
  return new Date(`${date}T${time || '09:00'}`).toISOString()
}
function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(15, (eh * 60 + em) - (sh * 60 + sm))
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
  const [optional, setOptional] = useState<string[]>([]) // subset of attendees marked optional
  const [agenda, setAgenda] = useState('')
  const [minutes, setMinutes] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showBusy, setShowBusy] = useState(false)

  const [linkType, setLinkType] = useState<'' | MeetingLinkType>('')
  const [linkEntityId, setLinkEntityId] = useState('')
  const [goals, setGoals] = useState<{ id: string; title: string }[]>([])

  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('11:00')
  const [actualDate, setActualDate] = useState('')
  const [actualStart, setActualStart] = useState('10:00')
  const [actualEnd, setActualEnd] = useState('11:00')

  const [saving, setSaving] = useState(false)

  const nameOf = useMemo(() => new Map(people.map((p) => [p.user_id, p.name])), [people])
  const requiredIds = useMemo(() => attendees.filter((a) => !optional.includes(a)), [attendees, optional])

  useEffect(() => {
    if (!isOpen) return
    setTitle(''); setType('online'); setOnlineLink(''); setOnlinePassword(''); setLocation('')
    setCallMode('fixed'); setAttendees([]); setOptional([]); setAgenda(''); setMinutes(''); setShowPassword(false); setShowBusy(false)
    setLinkType(''); setLinkEntityId('')
    setDate(''); setStartTime('10:00'); setEndTime('11:00')
    setActualDate(''); setActualStart('10:00'); setActualEnd('11:00')
  }, [isOpen])

  useEffect(() => {
    if (linkType === 'goal' && goals.length === 0) {
      goalsApi.list(orgId).then((gs) => setGoals(gs.map((g) => ({ id: g.id, title: g.title })))).catch(() => {})
    }
  }, [linkType, orgId, goals.length])

  // Keep the optional set a subset of the current attendees.
  useEffect(() => { setOptional((opt) => opt.filter((id) => attendees.includes(id))) }, [attendees])

  function toggleOptional(id: string) {
    setOptional((opt) => (opt.includes(id) ? opt.filter((x) => x !== id) : [...opt, id]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return addToast('Title is required', 'error')

    const dto: CreateMeetingInput = {
      title: title.trim(),
      type,
      attendee_user_ids: attendees,
      optional_user_ids: optional,
    }
    if (type !== 'offline') { if (onlineLink) dto.online_link = onlineLink; if (onlinePassword) dto.online_password = onlinePassword }
    if (type !== 'online') dto.location = location
    if (agenda.trim()) dto.agenda = agenda.trim()
    if (linkType) { dto.link_type = linkType; dto.link_entity_id = linkEntityId || undefined }

    if (callMode === 'fixed') {
      if (!date) return addToast('Pick a date', 'error')
      dto.scheduled_start = toISO(date, startTime)
      dto.scheduled_end = toISO(date, endTime)
    } else {
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

        {/* Attendees — opt-out: everyone added is attending by default */}
        <div>
          <label className={labelClass}>Attendees</label>
          <MeetingAttendeeSelector options={people} value={attendees} onChange={setAttendees} />
          <p className="text-xs text-[#64748B] mt-1">Everyone added is on the meeting. They can mark “can’t make it” with a reason. Toggle who is optional.</p>
          {attendees.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {attendees.map((id) => {
                const isOptional = optional.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleOptional(id)}
                    className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border"
                    style={isOptional
                      ? { backgroundColor: '#F1F5F9', color: '#475569', borderColor: '#E2E8F0' }
                      : { backgroundColor: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' }}
                    title="Toggle required / optional"
                  >
                    {nameOf.get(id) ?? 'Unknown'} · {isOptional ? 'Optional' : 'Required'}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Call mode */}
        <div>
          <label className={labelClass}>How to schedule</label>
          <div className="flex flex-wrap gap-2">
            {modeTab('fixed', 'Pick a time')}
            {modeTab('log_past', 'Log a past meeting')}
          </div>
        </div>

        {callMode === 'fixed' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Date *</label>
                <DatePicker value={date} onChange={setDate} min={todayStr()} placeholder="Select date" />
              </div>
              <div>
                <label className={labelClass}>Start</label>
                <TimeField value={startTime} onChange={setStartTime} />
              </div>
              <div>
                <label className={labelClass}>End</label>
                <TimeField value={endTime} onChange={setEndTime} />
              </div>
            </div>
            {/* Busy-times peek: the organiser picks the time; the system only shows/ranks. */}
            {attendees.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowBusy((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563EB]"
                >
                  <CalendarSearch size={15} /> {showBusy ? 'Hide' : 'Check'} people’s busy times
                </button>
                {showBusy && date && (
                  <div className="mt-2">
                    <BusyTimesPanel
                      orgId={orgId}
                      userIds={attendees}
                      requiredIds={requiredIds}
                      from={new Date(`${date}T00:00`).toISOString()}
                      to={new Date(`${date}T23:59`).toISOString()}
                      durationMin={minutesBetween(startTime, endTime)}
                      onPick={(startIso) => {
                        const d = new Date(startIso)
                        const hh = String(d.getHours()).padStart(2, '0')
                        const mm = String(d.getMinutes()).padStart(2, '0')
                        setStartTime(`${hh}:${mm}`)
                        const dur = minutesBetween(startTime, endTime)
                        const end = new Date(d.getTime() + dur * 60000)
                        setEndTime(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`)
                      }}
                    />
                  </div>
                )}
                {showBusy && !date && <p className="text-xs text-[#94A3B8] mt-2">Pick a date to see busy times for that day.</p>}
              </div>
            )}
          </>
        )}

        {callMode === 'log_past' && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Date *</label>
              <DatePicker value={actualDate} onChange={setActualDate} max={todayStr()} placeholder="Select date" />
            </div>
            <div>
              <label className={labelClass}>Started</label>
              <TimeField value={actualStart} onChange={setActualStart} />
            </div>
            <div>
              <label className={labelClass}>Ended</label>
              <TimeField value={actualEnd} onChange={setActualEnd} />
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
