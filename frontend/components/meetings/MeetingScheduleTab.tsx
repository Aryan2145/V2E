'use client'

import { useMemo, useState } from 'react'
import { Check, X, CalendarClock, ThumbsUp, ThumbsDown, HelpCircle, Trash2, Plus, Sparkles, ArrowRightLeft } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { meetingsApi } from '@/lib/api/meetings'
import type { Meeting, MeetingSlot, MeetingVote } from '@/lib/types/meetings'
import { ResponseBadge, fmtDateTime, fmtTime } from './shared'

const inputClass = 'border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]'

export default function MeetingScheduleTab({
  orgId, meeting, userId, canManage, onChanged,
}: { orgId: string; meeting: Meeting; userId: string; canManage: boolean; onChanged: (m: Meeting) => void }) {
  const { addToast } = useToast()
  const attendees = meeting.attendees ?? []
  const me = attendees.find((a) => a.user_id === userId)
  const nameOf = useMemo(() => new Map(attendees.map((a) => [a.user_id, a.user?.name ?? 'Unknown'])), [attendees])

  const [busy, setBusy] = useState(false)
  const wrap = async (fn: () => Promise<Meeting>) => {
    setBusy(true)
    try { onChanged(await fn()) } catch (e: any) { addToast(e?.response?.data?.message ?? 'Action failed', 'error') } finally { setBusy(false) }
  }

  // ── Fixed mode ──────────────────────────────────────────────────────────────
  if (meeting.mode === 'fixed') {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
          <h3 className="text-[16px] font-semibold text-[#0F172A] mb-1">Scheduled time</h3>
          <p className="text-[15px] text-[#1E293B]">{fmtDateTime(meeting.scheduled_start)} – {fmtTime(meeting.scheduled_end)}</p>

          {meeting.status === 'scheduled' && me && !me.is_organizer && (
            <MyResponse meeting={meeting} orgId={orgId} busy={busy} onChanged={onChanged} />
          )}
          {meeting.can_convert_to_poll && canManage && (
            <button onClick={() => wrap(() => meetingsApi.convertToPoll(orgId, meeting.id))} disabled={busy} className="mt-4 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#CA8A04] border border-[#FDE68A] bg-[#FEFCE8] rounded-[8px]">
              <ArrowRightLeft size={15} /> Reschedule requests are piling up — convert to a poll
            </button>
          )}
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
          <h3 className="text-[16px] font-semibold text-[#0F172A] mb-3">Responses</h3>
          <div className="flex flex-col gap-2">
            {attendees.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 border border-[#E2E8F0] rounded-[8px] px-3 py-2">
                <div className="min-w-0">
                  <span className="text-[15px] text-[#0F172A]">{a.user?.name ?? 'Unknown'}{a.is_organizer && <span className="text-xs text-[#94A3B8] ml-1">(organizer)</span>}</span>
                  {a.response === 'rejected' && a.reject_reason && <p className="text-xs text-[#DC2626] mt-0.5">“{a.reject_reason}”</p>}
                  {a.response === 'reschedule_requested' && a.reschedule_at && (
                    <p className="text-xs text-[#CA8A04] mt-0.5">Prefers {fmtDateTime(a.reschedule_at)}{a.reschedule_note ? ` — ${a.reschedule_note}` : ''}</p>
                  )}
                </div>
                <ResponseBadge response={a.response} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Poll mode ───────────────────────────────────────────────────────────────
  const slots = (meeting.slots ?? []).filter((s) => !s.is_dismissed)
  const inviteeSlots = slots.filter((s) => s.source === 'invitee')
  const mainSlots = slots.filter((s) => s.source !== 'invitee')

  const SlotCard = ({ s }: { s: MeetingSlot }) => {
    const votes = s.votes ?? []
    const myVote = votes.find((v) => v.user_id === userId)?.vote
    const counts = { available: votes.filter((v) => v.vote === 'available').length, maybe: votes.filter((v) => v.vote === 'maybe').length, unavailable: votes.filter((v) => v.vote === 'unavailable').length }
    const voteBtn = (v: MeetingVote, Icon: any, color: string) => (
      <button
        onClick={() => wrap(() => meetingsApi.voteSlot(orgId, meeting.id, s.id, v))}
        disabled={busy || meeting.status !== 'polling'}
        className={['inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs font-medium border', myVote === v ? 'text-white' : 'bg-white'].join(' ')}
        style={myVote === v ? { backgroundColor: color, borderColor: color } : { color, borderColor: '#E2E8F0' }}
      >
        <Icon size={13} />
      </button>
    )
    return (
      <div className="flex items-center justify-between gap-3 border border-[#E2E8F0] rounded-[8px] px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] text-[#0F172A]">{fmtDateTime(s.start_at)} – {fmtTime(s.end_at)}</span>
            {s.source === 'system' && <span className="inline-flex items-center gap-1 text-[11px] text-[#7C3AED] bg-[#F5F3FF] border border-[#DDD6FE] rounded-full px-2 py-0.5"><Sparkles size={10} /> suggested</span>}
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">✓ {counts.available} · ? {counts.maybe} · ✕ {counts.unavailable}{s.source === 'invitee' ? ` · by ${nameOf.get(s.proposed_by_user_id ?? '') ?? 'invitee'}` : ''}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {voteBtn('available', ThumbsUp, '#16A34A')}
          {voteBtn('maybe', HelpCircle, '#CA8A04')}
          {voteBtn('unavailable', ThumbsDown, '#DC2626')}
          {canManage && meeting.status === 'polling' && (
            <>
              <button onClick={() => wrap(() => meetingsApi.confirmSlot(orgId, meeting.id, s.id))} disabled={busy} className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs font-semibold text-white bg-[#2563EB]"><Check size={13} /> Confirm</button>
              <button onClick={() => wrap(() => meetingsApi.dismissSlot(orgId, meeting.id, s.id))} disabled={busy} className="text-[#94A3B8] hover:text-[#DC2626] px-1" title="Dismiss"><Trash2 size={14} /></button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {meeting.status !== 'polling' && (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
          <h3 className="text-[16px] font-semibold text-[#0F172A] mb-1">Confirmed time</h3>
          <p className="text-[15px] text-[#1E293B]">{fmtDateTime(meeting.scheduled_start)} – {fmtTime(meeting.scheduled_end)}</p>
        </div>
      )}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
        <h3 className="text-[16px] font-semibold text-[#0F172A] mb-3">Time poll</h3>
        <div className="flex flex-col gap-2">{mainSlots.map((s) => <SlotCard key={s.id} s={s} />)}</div>
        {inviteeSlots.length > 0 && (
          <>
            <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider mt-4 mb-2">Proposed by attendees</p>
            <div className="flex flex-col gap-2">{inviteeSlots.map((s) => <SlotCard key={s.id} s={s} />)}</div>
          </>
        )}
        {meeting.status === 'polling' && <AddSlot orgId={orgId} meetingId={meeting.id} busy={busy} onChanged={onChanged} />}
      </div>
    </div>
  )
}

function MyResponse({ meeting, orgId, busy, onChanged }: { meeting: Meeting; orgId: string; busy: boolean; onChanged: (m: Meeting) => void }) {
  const { addToast } = useToast()
  const [mode, setMode] = useState<'' | 'reject' | 'reschedule'>('')
  const [reason, setReason] = useState('')
  const [when, setWhen] = useState('')
  const [note, setNote] = useState('')
  const act = async (action: 'accept' | 'reject' | 'reschedule') => {
    try {
      const m = await meetingsApi.respond(orgId, meeting.id, {
        action,
        reason: action === 'reject' ? reason : undefined,
        reschedule_at: action === 'reschedule' && when ? new Date(when).toISOString() : undefined,
        reschedule_note: action === 'reschedule' ? note : undefined,
      })
      onChanged(m)
      setMode('')
    } catch (e: any) { addToast(e?.response?.data?.message ?? 'Failed', 'error') }
  }
  return (
    <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
      <p className="text-sm font-medium text-[#374151] mb-2">Your response</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => act('accept')} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#16A34A] rounded-[8px]"><Check size={15} /> Accept</button>
        <button onClick={() => setMode(mode === 'reject' ? '' : 'reject')} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#DC2626] border border-[#FECACA] rounded-[8px]"><X size={15} /> Reject</button>
        <button onClick={() => setMode(mode === 'reschedule' ? '' : 'reschedule')} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#CA8A04] border border-[#FDE68A] rounded-[8px]"><CalendarClock size={15} /> Request reschedule</button>
      </div>
      {mode === 'reject' && (
        <div className="mt-2 flex gap-2">
          <input className={`${inputClass} flex-1`} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="danger" onClick={() => act('reject')} disabled={!reason.trim()}>Submit</Button>
        </div>
      )}
      {mode === 'reschedule' && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input type="datetime-local" className={inputClass} value={when} onChange={(e) => setWhen(e.target.value)} />
          <input className={`${inputClass} flex-1`} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button variant="primary" onClick={() => act('reschedule')} disabled={!when}>Submit</Button>
        </div>
      )}
    </div>
  )
}

function AddSlot({ orgId, meetingId, busy, onChanged }: { orgId: string; meetingId: string; busy: boolean; onChanged: (m: Meeting) => void }) {
  const { addToast } = useToast()
  const [date, setDate] = useState('')
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('11:00')
  const add = async () => {
    if (!date) return
    try {
      const m = await meetingsApi.addSlot(orgId, meetingId, { start_at: new Date(`${date}T${start}`).toISOString(), end_at: new Date(`${date}T${end}`).toISOString() })
      onChanged(m); setDate('')
    } catch (e: any) { addToast(e?.response?.data?.message ?? 'Failed', 'error') }
  }
  return (
    <div className="flex flex-wrap items-end gap-2 mt-4 pt-4 border-t border-[#E2E8F0]">
      <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      <input type="time" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
      <input type="time" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
      <button onClick={add} disabled={busy || !date} className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#2563EB] border border-[#2563EB] rounded-[8px]"><Plus size={15} /> Propose slot</button>
    </div>
  )
}
