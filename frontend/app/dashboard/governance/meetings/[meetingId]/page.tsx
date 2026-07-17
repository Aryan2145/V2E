'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Play, Square, Lock, Unlock, Trash2, Video, MapPin, Users, CalendarClock,
  Plus, CheckCircle2, Circle, Link2, AlertTriangle, Gavel, Copy, Check, X, Eye, EyeOff,
} from 'lucide-react'
import { renderMarkdown } from '@/lib/markdown'
import { useAuth } from '@/lib/auth/context'
import { meetingsApi } from '@/lib/api/meetings'
import { getEmployees } from '@/lib/api/employees'
import Button from '@/components/ui/Button'
import DatePicker from '@/components/ui/DatePicker'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { LINK_TYPE_LABEL, TYPE_LABEL, type Meeting, type MeetingAnalytics } from '@/lib/types/meetings'
import { StatusBadge, ResponseBadge, fmtDate, fmtDateTime, fmtTime, useMeetingPermissions } from '@/components/meetings/shared'
import MeetingScheduleTab from '@/components/meetings/MeetingScheduleTab'
import MeetingRecordTab from '@/components/meetings/MeetingRecordTab'

const inputClass = 'border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]'
const TABS = ['Overview', 'Schedule', 'Record', 'Action items', 'Decisions', 'Edit log', 'My notes', 'Analytics'] as const
type Tab = (typeof TABS)[number]

export default function MeetingDetailPage({ params }: { params: { meetingId: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''
  const userId = user?.id ?? ''
  const { perms } = useMeetingPermissions(orgId)
  const { addToast } = useToast()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [people, setPeople] = useState<{ user_id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Overview')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const nameOf = useMemo(() => new Map(people.map((p) => [p.user_id, p.name])), [people])

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    const [m, emps] = await Promise.all([
      meetingsApi.get(orgId, params.meetingId).catch(() => null),
      getEmployees(orgId).catch(() => []),
    ])
    setMeeting(m)
    setPeople((emps as any[]).map((e) => ({ user_id: e.user_id, name: e.user?.name ?? e.name ?? e.email ?? 'Unknown' })))
    setLoading(false)
  }, [orgId, params.meetingId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="p-10 text-center text-sm text-[#475569]">Loading…</div>
  if (!meeting) return (
    <div className="p-12 text-center">
      <h2 className="text-[18px] font-semibold text-[#0F172A]">Meeting not found</h2>
      <Link href="/dashboard/governance/meetings" className="text-sm text-[#2563EB] hover:underline mt-2 inline-block">Back to meetings</Link>
    </div>
  )

  const m = meeting
  const canManage = m.can_manage ?? false
  const onChanged = (updated: Meeting) => setMeeting(updated)
  const act = async (fn: () => Promise<Meeting>, msg?: string) => {
    try { setMeeting(await fn()); if (msg) addToast(msg, 'success') } catch (e: any) { addToast(e?.response?.data?.message ?? 'Action failed', 'error') }
  }

  async function copySummary() {
    const lines = [
      `# ${m.title}`,
      `When: ${fmtDateTime(m.scheduled_start)}`,
      `Organizer: ${m.organizer?.name ?? '—'}`,
      `Type: ${TYPE_LABEL[m.type]}${m.location ? ` · ${m.location}` : ''}`,
      '',
      '## Attendees',
      ...(m.attendees ?? []).map((a) => `- ${a.user?.name ?? nameOf.get(a.user_id) ?? 'Unknown'} (${a.response})${a.attended ? ' ✓ attended' : ''}`),
      '',
      '## Agenda',
      m.agenda || '—',
      '',
      '## Minutes',
      m.minutes || '—',
      '',
      '## Decisions',
      ...((m.decisions ?? []).length ? (m.decisions ?? []).map((d) => `- ${d.decision}${d.reason ? ` (${d.reason})` : ''}`) : ['—']),
      '',
      '## Action items',
      ...((m.action_items ?? []).length ? (m.action_items ?? []).map((it) => `- [${it.is_done ? 'x' : ' '}] ${it.text}${it.owner_user_id ? ` — ${nameOf.get(it.owner_user_id) ?? 'owner'}` : ''}${it.due_date ? ` (due ${fmtDate(it.due_date)})` : ''}`) : ['—']),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      addToast('Summary copied to clipboard', 'success')
    } catch {
      addToast('Could not copy', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/dashboard/governance/meetings" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#475569] hover:text-[#0F172A] w-fit"><ArrowLeft size={15} /> Meetings</Link>

      {/* Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StatusBadge status={m.status} />
              <span className="inline-flex items-center gap-1 text-xs text-[#64748B]">{m.type === 'offline' ? <MapPin size={12} /> : <Video size={12} />} {TYPE_LABEL[m.type]}</span>
              {m.link_type && <span className="text-xs text-[#2563EB] bg-[#EFF6FF] rounded-full px-2 py-0.5">{LINK_TYPE_LABEL[m.link_type]}</span>}
            </div>
            <h1 className="text-[24px] font-bold text-[#0F172A] leading-tight">{m.title}</h1>
            <div className="flex items-center gap-3 text-sm text-[#475569] mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1"><CalendarClock size={14} /> {fmtDateTime(m.scheduled_start)}</span>
              <span className="inline-flex items-center gap-1"><Users size={14} /> {m.organizer?.name}</span>
              {m.type !== 'offline' && m.online_link && <a href={m.online_link} target="_blank" rel="noreferrer" className="text-[#2563EB] hover:underline">Join link</a>}
              {m.location && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {m.location}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button onClick={copySummary} title="Copy summary" aria-label="Copy summary" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#475569] border border-[#E2E8F0] rounded-[8px] hover:bg-[#F8FAFC]"><Copy size={14} /> Summary</button>
            {canManage && m.status === 'scheduled' && <button onClick={() => act(() => meetingsApi.start(orgId, m.id), 'Meeting started')} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#16A34A] rounded-[8px]"><Play size={14} /> Start</button>}
            {canManage && m.status === 'in_progress' && <button onClick={() => act(() => meetingsApi.end(orgId, m.id), 'Marked ended')} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#475569] border border-[#E2E8F0] rounded-[8px]"><Square size={14} /> End</button>}
            {canManage && (m.status === 'in_progress' || m.status === 'scheduled') && <button onClick={() => act(() => meetingsApi.close(orgId, m.id), 'Meeting closed')} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-[8px]"><Lock size={14} /> Close</button>}
            {canManage && m.status === 'closed' && <button onClick={() => act(() => meetingsApi.reopen(orgId, m.id), 'Meeting reopened')} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#CA8A04] border border-[#FDE68A] rounded-[8px]"><Unlock size={14} /> Reopen</button>}
            {perms.delete && <button onClick={() => setDeleteOpen(true)} aria-label="Delete meeting" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#DC2626] border border-[#FECACA] rounded-[8px]"><Trash2 size={14} /></button>}
          </div>
        </div>

        {(m.conflicts?.length ?? 0) > 0 && (
          <div className="mt-4 flex items-start gap-2 bg-[#FEF9C3] border border-[#FDE68A] rounded-[8px] px-3 py-2 text-sm text-[#854D0E]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>Scheduling conflict: {m.conflicts!.map((c) => `${nameOf.get(c.user_id) ?? 'Someone'} (${c.title})`).join(', ')}. Not blocked — attendees decide.</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-[#E2E8F0] overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={['px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors', tab === t ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-[#475569] hover:text-[#0F172A]'].join(' ')}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab meeting={m} canManage={canManage} orgId={orgId} userId={userId} onChanged={onChanged} nameOf={nameOf} />}
      {tab === 'Schedule' && <MeetingScheduleTab orgId={orgId} meeting={m} userId={userId} canManage={canManage} onChanged={onChanged} />}
      {tab === 'Record' && <MeetingRecordTab orgId={orgId} meeting={m} canEdit={true} onSaved={load} />}
      {tab === 'Action items' && <ActionItemsTab meeting={m} orgId={orgId} people={people} nameOf={nameOf} onChanged={onChanged} />}
      {tab === 'Decisions' && <DecisionsTab meeting={m} orgId={orgId} people={people} nameOf={nameOf} onChanged={onChanged} />}
      {tab === 'Edit log' && <EditLogTab orgId={orgId} meetingId={m.id} />}
      {tab === 'My notes' && <MyNotesTab orgId={orgId} meeting={m} />}
      {tab === 'Analytics' && <AnalyticsTab orgId={orgId} meetingId={m.id} />}

      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete meeting" size="sm">
        <p className="text-sm text-[#1E293B]">Are you sure? This can&apos;t be undone.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={async () => { await meetingsApi.remove(orgId, m.id); addToast('Meeting deleted', 'success'); router.push('/dashboard/governance/meetings') }}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}

// ─── Overview (agenda + RSVP + attendees + attendance) ─────────────────────────
function OverviewTab({ meeting, canManage, orgId, userId, onChanged, nameOf }: { meeting: Meeting; canManage: boolean; orgId: string; userId: string; onChanged: (m: Meeting) => void; nameOf: Map<string, string> }) {
  const { addToast } = useToast()
  const attendees = meeting.attendees ?? []
  const me = attendees.find((a) => a.user_id === userId)
  const canMarkAttendance = canManage && (meeting.status === 'in_progress' || meeting.status === 'closed')
  const open = meeting.status === 'scheduled' || meeting.status === 'in_progress'
  const iDeclined = !!me && me.response === 'declined'
  const canDecline = !!me && !me.is_organizer && open
  const [showPw, setShowPw] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [declining, setDeclining] = useState(false)

  async function toggleAttended(uid: string, attended: boolean) {
    try { onChanged(await meetingsApi.markAttendance(orgId, meeting.id, [{ user_id: uid, attended }])) }
    catch (e: any) { addToast(e?.response?.data?.message ?? 'Failed', 'error') }
  }
  async function decline(reason: string) {
    try { onChanged(await meetingsApi.decline(orgId, meeting.id, reason)); addToast('You declined', 'success'); setDeclining(false); setDeclineReason('') }
    catch (e: any) { addToast(e?.response?.data?.message ?? 'Failed', 'error') }
  }
  async function undoDecline() {
    try { onChanged(await meetingsApi.undoDecline(orgId, meeting.id)); addToast('You’re back on the meeting', 'success') }
    catch (e: any) { addToast(e?.response?.data?.message ?? 'Failed', 'error') }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Online access */}
      {meeting.type !== 'offline' && (meeting.online_link || meeting.online_password) && (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 flex flex-wrap items-center gap-4 text-sm">
          {meeting.online_link && <a href={meeting.online_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#2563EB] font-medium hover:underline"><Video size={15} /> Join link</a>}
          {meeting.online_password && (
            <span className="inline-flex items-center gap-2 text-[#475569]">
              Password: <code className="bg-[#F1F5F9] px-2 py-0.5 rounded">{showPw ? meeting.online_password : '••••••••'}</code>
              <button onClick={() => setShowPw((v) => !v)} className="text-[#94A3B8] hover:text-[#475569]" aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </span>
          )}
        </div>
      )}

      {/* Attendance response — opt-out: you're on it unless you say otherwise */}
      {canDecline && !iDeclined && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-[12px] p-4">
          <p className="text-sm font-medium text-[#1E293B] mb-2">You’re on this meeting.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setDeclining((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#DC2626] border border-[#FECACA] bg-white rounded-[8px]"><X size={15} /> Can’t make it</button>
            <span className="text-xs text-[#64748B]">Only say something if you can’t attend — a reason is required.</span>
          </div>
          {declining && (
            <div className="flex gap-2 mt-2">
              <input className="flex-1 border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm" placeholder="Reason (required)" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
              <Button variant="danger" disabled={!declineReason.trim()} onClick={() => decline(declineReason)}>Submit</Button>
            </div>
          )}
        </div>
      )}
      {canDecline && iDeclined && (
        <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-[12px] p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-[#991B1B]">You said you can’t make it{me?.reject_reason ? `: “${me.reject_reason}”` : ''}.</p>
          <Button variant="secondary" onClick={undoDecline}>I can make it after all</Button>
        </div>
      )}

      {/* Agenda */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
        <h3 className="text-[16px] font-semibold text-[#0F172A] mb-2">Agenda</h3>
        <div className="text-[15px] text-[#1E293B]" dangerouslySetInnerHTML={{ __html: renderMarkdown(meeting.agenda ?? '') || '<span class="text-[#94A3B8]">No agenda set. Add one in the Record tab.</span>' }} />
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
      <h3 className="text-[16px] font-semibold text-[#0F172A] mb-3">Attendees ({attendees.length})</h3>
      <div className="flex flex-col gap-2">
        {attendees.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 border border-[#E2E8F0] rounded-[8px] px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              {canMarkAttendance ? (
                <button onClick={() => toggleAttended(a.user_id, !a.attended)} className="text-[#475569] shrink-0" aria-label="Toggle attended">{a.attended ? <CheckCircle2 size={18} className="text-[#16A34A]" /> : <Circle size={18} className="text-[#CBD5E1]" />}</button>
              ) : a.attended ? <CheckCircle2 size={18} className="text-[#16A34A] shrink-0" /> : null}
              <div className="min-w-0">
                <span className="text-[15px] text-[#0F172A]">
                  {a.user?.name ?? nameOf.get(a.user_id) ?? 'Unknown'}
                  {a.is_organizer && <span className="text-xs text-[#94A3B8] ml-1">(organizer)</span>}
                  {!a.is_organizer && !a.is_required && <span className="text-[11px] font-medium text-[#64748B] bg-[#F1F5F9] rounded-full px-2 py-0.5 ml-2">Optional</span>}
                </span>
                {a.response === 'declined' && a.reject_reason && (
                  <p className="text-xs text-[#DC2626] mt-0.5 truncate">“{a.reject_reason}”{a.is_required ? <span className="text-[#B45309]"> · was required</span> : null}</p>
                )}
              </div>
            </div>
            <ResponseBadge response={a.response} />
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}

// ─── Action items ───────────────────────────────────────────────────────────────
function ActionItemsTab({ meeting, orgId, people, nameOf, onChanged }: { meeting: Meeting; orgId: string; people: { user_id: string; name: string }[]; nameOf: Map<string, string>; onChanged: (m: Meeting) => void }) {
  const { addToast } = useToast()
  const items = meeting.action_items ?? []
  const [text, setText] = useState('')
  const [owner, setOwner] = useState('')
  const [due, setDue] = useState('')
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const locked = meeting.status === 'closed' || meeting.status === 'cancelled'

  const run = async (fn: () => Promise<Meeting>, ok?: string) => {
    try { onChanged(await fn()); if (ok) addToast(ok, 'success') } catch (e: any) { addToast(e?.response?.data?.message ?? 'Failed', 'error') }
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
      <h3 className="text-[16px] font-semibold text-[#0F172A] mb-3">Action items</h3>
      <div className="flex flex-col gap-2">
        {items.length === 0 && <p className="text-sm text-[#94A3B8]">No action items yet.</p>}
        {items.map((it) => (
          <div key={it.id} className="border border-[#E2E8F0] rounded-[8px] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <button disabled={locked} onClick={() => run(() => meetingsApi.updateActionItem(orgId, meeting.id, it.id, { is_done: !it.is_done }))}>{it.is_done ? <CheckCircle2 size={18} className="text-[#16A34A]" /> : <Circle size={18} className="text-[#CBD5E1]" />}</button>
                <div className="min-w-0">
                  <p className={['text-[15px]', it.is_done ? 'text-[#94A3B8] line-through' : 'text-[#0F172A]'].join(' ')}>{it.text}</p>
                  <p className="text-xs text-[#64748B] flex items-center gap-1.5 flex-wrap">
                    <span>{it.owner_user_id ? nameOf.get(it.owner_user_id) ?? 'Owner' : 'Unassigned'}{it.due_date ? ` · due ${fmtDate(it.due_date)}` : ''}</span>
                    {it.due_date && !it.is_done && new Date(it.due_date) < new Date() && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#DC2626] bg-[#FEE2E2] border border-[#FECACA] rounded-full px-1.5 py-0"><AlertTriangle size={10} /> Overdue</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {it.linked_task_id ? (
                  <span className="inline-flex items-center gap-1 text-xs text-[#16A34A] bg-[#DCFCE7] rounded-full px-2 py-0.5"><Link2 size={11} /> Task linked</span>
                ) : (
                  <button disabled={locked} onClick={() => setLinkingId(linkingId === it.id ? null : it.id)} className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB]"><Link2 size={12} /> Link task</button>
                )}
                {!locked && <button onClick={() => run(() => meetingsApi.deleteActionItem(orgId, meeting.id, it.id))} className="text-[#94A3B8] hover:text-[#DC2626]"><Trash2 size={14} /></button>}
              </div>
            </div>
            {linkingId === it.id && !it.linked_task_id && (
              <LinkTaskRow item={it} people={people} onAttachId={(tid) => run(() => meetingsApi.linkTask(orgId, meeting.id, it.id, { task_id: tid }), 'Task linked').then(() => setLinkingId(null))} onCreate={(title, assignee, deadline) => run(() => meetingsApi.linkTask(orgId, meeting.id, it.id, { create: { title, assignee_user_ids: [assignee], deadline } }), 'Task created & linked').then(() => setLinkingId(null))} />
            )}
          </div>
        ))}
      </div>

      {!locked && (
        <div className="flex flex-wrap items-end gap-2 mt-4 pt-4 border-t border-[#E2E8F0]">
          <input className={`${inputClass} flex-1 min-w-[200px]`} placeholder="New action item…" value={text} onChange={(e) => setText(e.target.value)} />
          <select className={inputClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Owner</option>
            {people.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
          </select>
          <DatePicker value={due} onChange={setDue} placeholder="Select date" />
          <button onClick={() => { if (!text.trim()) return; run(() => meetingsApi.addActionItem(orgId, meeting.id, { text: text.trim(), owner_user_id: owner || undefined, due_date: due ? new Date(due).toISOString() : undefined })); setText(''); setOwner(''); setDue('') }} className="inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px]"><Plus size={15} /> Add</button>
        </div>
      )}
    </div>
  )
}

function LinkTaskRow({ item, people, onAttachId, onCreate }: { item: { text: string; owner_user_id: string | null; due_date: string | null }; people: { user_id: string; name: string }[]; onAttachId: (id: string) => void; onCreate: (title: string, assignee: string, deadline?: string) => void }) {
  const [title, setTitle] = useState(item.text)
  const [assignee, setAssignee] = useState(item.owner_user_id ?? '')
  const [taskId, setTaskId] = useState('')
  return (
    <div className="mt-2 pt-2 border-t border-[#F1F5F9] flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <input className={`${inputClass} flex-1 min-w-[160px]`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
        <select className={inputClass} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Executor</option>
          {people.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
        </select>
        <button onClick={() => assignee && onCreate(title, assignee, item.due_date ?? undefined)} disabled={!assignee || !title.trim()} className="px-3 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-[8px] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]">Create &amp; link</button>
      </div>
      <div className="flex items-center gap-2">
        <input className={`${inputClass} flex-1`} value={taskId} onChange={(e) => setTaskId(e.target.value)} placeholder="…or paste an existing task ID" />
        <button onClick={() => taskId && onAttachId(taskId)} disabled={!taskId} className="px-3 py-2 text-sm font-medium text-[#2563EB] border border-[#2563EB] rounded-[8px] disabled:opacity-50">Attach</button>
      </div>
    </div>
  )
}

// ─── Decisions ──────────────────────────────────────────────────────────────────
function DecisionsTab({ meeting, orgId, people, nameOf, onChanged }: { meeting: Meeting; orgId: string; people: { user_id: string; name: string }[]; nameOf: Map<string, string>; onChanged: (m: Meeting) => void }) {
  const { addToast } = useToast()
  const decisions = meeting.decisions ?? []
  const [decision, setDecision] = useState('')
  const [owner, setOwner] = useState('')
  const [reason, setReason] = useState('')
  const locked = meeting.status === 'closed' || meeting.status === 'cancelled'
  const run = async (fn: () => Promise<Meeting>, ok?: string) => { try { onChanged(await fn()); if (ok) addToast(ok, 'success') } catch (e: any) { addToast(e?.response?.data?.message ?? 'Failed', 'error') } }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
      <h3 className="text-[16px] font-semibold text-[#0F172A] mb-3 flex items-center gap-2"><Gavel size={16} className="text-[#2563EB]" /> Decisions</h3>
      <div className="flex flex-col gap-2">
        {decisions.length === 0 && <p className="text-sm text-[#94A3B8]">No decisions logged.</p>}
        {decisions.map((d) => (
          <div key={d.id} className="border border-[#E2E8F0] rounded-[8px] px-3 py-2 flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] text-[#0F172A] font-medium">{d.decision}</p>
              <p className="text-xs text-[#64748B] mt-0.5">{d.owner_user_id ? nameOf.get(d.owner_user_id) ?? 'Owner' : '—'} · {fmtDate(d.decided_on)}{d.reason ? ` · ${d.reason}` : ''}</p>
            </div>
            {!locked && <button onClick={() => run(() => meetingsApi.deleteDecision(orgId, meeting.id, d.id))} className="text-[#94A3B8] hover:text-[#DC2626] shrink-0"><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>
      {!locked && (
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[#E2E8F0]">
          <input className={inputClass} placeholder="Decision…" value={decision} onChange={(e) => setDecision(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <select className={inputClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Owner</option>
              {people.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
            </select>
            <input className={`${inputClass} flex-1 min-w-[160px]`} placeholder="One-line reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button onClick={() => { if (!decision.trim()) return; run(() => meetingsApi.addDecision(orgId, meeting.id, { decision: decision.trim(), owner_user_id: owner || undefined, reason: reason || undefined })); setDecision(''); setOwner(''); setReason('') }} className="inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px]"><Plus size={15} /> Log decision</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Edit log / My notes / Analytics ────────────────────────────────────────────
function EditLogTab({ orgId, meetingId }: { orgId: string; meetingId: string }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { meetingsApi.editLog(orgId, meetingId).then((r) => setItems(r.items)).catch(() => setItems([])).finally(() => setLoading(false)) }, [orgId, meetingId])
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
      <h3 className="text-[16px] font-semibold text-[#0F172A] mb-3">Edit log</h3>
      {loading ? <p className="text-sm text-[#475569]">Loading…</p> : items.length === 0 ? <p className="text-sm text-[#94A3B8]">No changes recorded yet.</p> : (
        <div className="flex flex-col gap-2">
          {items.map((e) => (
            <div key={e.id} className="flex items-center gap-3 text-sm border-b border-[#F1F5F9] pb-2">
              <span className="text-[#475569] w-40 shrink-0">{fmtDateTime(e.created_at)}</span>
              <span className="text-[#0F172A]">{e.actor?.name ?? '—'}</span>
              <span className="text-[#64748B]">{e.changes ? Object.keys(e.changes).map((k) => k.replace(/_/g, ' ')).join(', ') : e.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MyNotesTab({ orgId, meeting }: { orgId: string; meeting: Meeting }) {
  const { addToast } = useToast()
  const [body, setBody] = useState(meeting.my_note ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  async function save() {
    setSaving(true)
    try {
      await meetingsApi.saveMyNote(orgId, meeting.id, body)
      addToast('Notes saved', 'success')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { addToast('Failed', 'error') } finally { setSaving(false) }
  }
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
      <h3 className="text-[16px] font-semibold text-[#0F172A] mb-1">My private notes</h3>
      <p className="text-xs text-[#94A3B8] mb-3">Only you can see these. They are never part of the official record.</p>
      <textarea className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-[15px] text-[#0F172A] focus:outline-none focus:border-[#2563EB] resize-y" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex justify-end items-center gap-3 mt-3">
        {saved && <span className="inline-flex items-center gap-1 text-sm font-medium text-[#16A34A]"><Check size={15} /> Saved</span>}
        <Button variant="primary" isLoading={saving} disabled={saving} onClick={save}>Save notes</Button>
      </div>
    </div>
  )
}

function AnalyticsTab({ orgId, meetingId }: { orgId: string; meetingId: string }) {
  const [data, setData] = useState<MeetingAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { meetingsApi.analytics(orgId, meetingId).then(setData).catch(() => setData(null)).finally(() => setLoading(false)) }, [orgId, meetingId])
  if (loading) return <div className="p-6 text-sm text-[#475569]">Loading…</div>
  if (!data) return <div className="p-6 text-sm text-[#94A3B8]">No analytics.</div>
  const stat = (label: string, value: string | number, color = '#0F172A') => (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4">
      <p className="text-[24px] font-bold leading-none" style={{ color }}>{value}</p>
      <p className="text-sm text-[#475569] mt-1">{label}</p>
    </div>
  )
  const att = data.attendance
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stat('Planned (min)', data.planned_minutes ?? '—')}
        {stat('Actual (min)', data.actual_minutes ?? '—', (data.overrun_minutes ?? 0) > 0 ? '#D97706' : '#16A34A')}
        {stat('Expected', att.expected)}
        {stat('Attended', att.attendance_recorded ? `${att.attended}/${att.expected}` : '—')}
        {stat('No-shows', att.no_show === null ? '—' : att.no_show, att.no_show ? '#DC2626' : '#16A34A')}
        {stat('Declined', att.declined, att.declined ? '#DC2626' : '#0F172A')}
        {stat('Declined (required)', att.declined_required, att.declined_required ? '#DC2626' : '#16A34A')}
        {stat('Action items', data.action_items.created)}
        {stat('Linked to tasks', data.action_items.linked)}
        {stat('Done', data.action_items.done, '#16A34A')}
        {stat('Decisions', data.decisions, data.decisions ? '#16A34A' : '#DC2626')}
      </div>
      {!att.attendance_recorded && (
        <div className="flex items-start gap-2 bg-[#F1F5F9] border border-[#E2E8F0] rounded-[8px] px-3 py-2 text-sm text-[#475569]">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#94A3B8]" />
          <span>Attendance hasn’t been recorded for this meeting, so no-shows aren’t counted. Mark attendance on the Overview tab.</span>
        </div>
      )}
    </div>
  )
}
