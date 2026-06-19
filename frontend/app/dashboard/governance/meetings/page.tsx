'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, List, Plus, Search, Video, MapPin, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { meetingsApi } from '@/lib/api/meetings'
import { getEmployees } from '@/lib/api/employees'
import {
  TYPE_LABEL,
  type Meeting,
  type MeetingStatus,
  type MeetingType,
} from '@/lib/types/meetings'
import { StatusBadge, fmtDateTime, useMeetingPermissions } from '@/components/meetings/shared'
import MeetingCalendarView from '@/components/meetings/MeetingCalendarView'
import CreateMeetingModal from '@/components/meetings/CreateMeetingModal'
import type { PersonOption } from '@/components/meetings/MeetingAttendeeSelector'
import ResponsiveTable, { type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

const selectClass =
  'border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'

const meetingColumns: ResponsiveColumn<Meeting>[] = [
  {
    key: 'meeting',
    header: 'Meeting',
    primary: true,
    render: (m) => (
      <>
        <div className="flex items-center gap-2">
          {m.type === 'offline' ? <MapPin size={14} className="text-[#94A3B8]" /> : <Video size={14} className="text-[#94A3B8]" />}
          <span className="font-medium text-[#0F172A] text-[15px]">{m.title}</span>
        </div>
        <div className="text-xs text-[#64748B] mt-0.5 flex items-center gap-2">
          <span>{TYPE_LABEL[m.type]}</span>
          <span className="inline-flex items-center gap-1"><Users size={11} /> {m._count?.attendees ?? 0}</span>
          {m.mode === 'poll' && <span className="text-[#CA8A04]">poll</span>}
        </div>
      </>
    ),
  },
  {
    key: 'when',
    header: 'When',
    desktopHiddenBelow: 'md',
    render: (m) => (
      <span className="text-sm text-[#475569]">{m.status === 'polling' ? 'Finding a slot' : fmtDateTime(m.scheduled_start)}</span>
    ),
  },
  {
    key: 'organizer',
    header: 'Organizer',
    render: (m) => <span className="text-sm text-[#1E293B]">{m.organizer?.name ?? '—'}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (m) => <StatusBadge status={m.status} />,
  },
]

export default function MeetingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = user?.organizationId ?? ''
  const { perms } = useMeetingPermissions(orgId)

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [people, setPeople] = useState<PersonOption[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<MeetingStatus | ''>('')
  const [type, setType] = useState<MeetingType | ''>('')
  const [mine, setMine] = useState(false)

  const view = searchParams.get('view') === 'calendar' ? 'calendar' : 'list'
  function setView(v: 'list' | 'calendar') {
    const p = new URLSearchParams(searchParams.toString())
    if (v === 'list') p.delete('view')
    else p.set('view', v)
    router.replace(`/dashboard/governance/meetings?${p.toString()}`)
  }

  const load = useCallback(() => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    Promise.all([meetingsApi.list(orgId).catch(() => []), getEmployees(orgId).catch(() => [])])
      .then(([ms, emps]: any[]) => {
        setMeetings(ms)
        setPeople((emps as any[]).map((e) => ({ user_id: e.user_id, name: e.user?.name ?? e.name ?? e.email ?? 'Unknown', email: e.user?.email })))
      })
      .finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => meetings.filter((m) => {
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false
    if (status && m.status !== status) return false
    if (type && m.type !== type) return false
    if (mine && m.created_by_user_id !== user?.id && !(m.attendees ?? []).some((a) => a.user_id === user?.id)) return false
    return true
  }), [meetings, search, status, type, mine, user?.id])

  const stats = useMemo(() => {
    const s = { total: meetings.length, scheduled: 0, polling: 0, closed: 0 }
    for (const m of meetings) {
      if (m.status === 'scheduled') s.scheduled++
      else if (m.status === 'polling') s.polling++
      else if (m.status === 'closed') s.closed++
    }
    return s
  }, [meetings])

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight">Meetings</h1>
          <p className="text-sm text-[#475569] mt-1">Schedule, run and record meetings — with action items and decisions.</p>
        </div>
        {perms.write && (
          <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] shrink-0">
            <Plus size={16} /> New Meeting
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', value: stats.total, color: '#2563EB' },
          { label: 'Scheduled', value: stats.scheduled, color: '#0369A1' },
          { label: 'In poll', value: stats.polling, color: '#CA8A04' },
          { label: 'Closed', value: stats.closed, color: '#16A34A' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-[#E2E8F0] rounded-[12px] p-4">
            <p className="text-[28px] font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-sm text-[#475569] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input className={`${selectClass} w-full pl-9`} placeholder="Search meetings…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="">All statuses</option>
          {['polling', 'scheduled', 'in_progress', 'closed', 'cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="">All types</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <button onClick={() => setMine((v) => !v)} className={['px-3 py-2 text-sm font-medium rounded-[8px] border', mine ? 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]' : 'bg-white text-[#475569] border-[#E2E8F0]'].join(' ')}>
          My meetings
        </button>
        <div className="flex rounded-[8px] border border-[#E2E8F0] overflow-hidden">
          <button aria-label="List view" aria-pressed={view === 'list'} title="List view" onClick={() => setView('list')} className={['px-3 py-2', view === 'list' ? 'bg-[#2563EB] text-white' : 'bg-white text-[#475569]'].join(' ')}><List size={16} /></button>
          <button aria-label="Calendar view" aria-pressed={view === 'calendar'} title="Calendar view" onClick={() => setView('calendar')} className={['px-3 py-2', view === 'calendar' ? 'bg-[#2563EB] text-white' : 'bg-white text-[#475569]'].join(' ')}><CalendarDays size={16} /></button>
        </div>
      </div>

      {view === 'calendar' ? (
        loading ? (
          <div className="p-10 text-center text-sm text-[#475569]">Loading…</div>
        ) : (
          <MeetingCalendarView meetings={filtered} onSelect={(id) => router.push(`/dashboard/governance/meetings/${id}`)} />
        )
      ) : (
        <ResponsiveTable
          columns={meetingColumns}
          rows={filtered}
          rowKey={(m) => m.id}
          loading={loading}
          onRowClick={(m) => router.push(`/dashboard/governance/meetings/${m.id}`)}
          emptyState={
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-12 text-center">
              <div className="w-14 h-14 rounded-[16px] bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] mx-auto mb-3"><CalendarDays size={26} /></div>
              <h3 className="text-[18px] font-semibold text-[#0F172A]">No meetings</h3>
              <p className="text-sm text-[#475569] mt-1">Create one to get started.</p>
            </div>
          }
        />
      )}

      <CreateMeetingModal isOpen={createOpen} onClose={() => setCreateOpen(false)} orgId={orgId} people={people} onCreated={() => load()} />
    </div>
  )
}
