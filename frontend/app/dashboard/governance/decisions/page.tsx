'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gavel, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { meetingsApi } from '@/lib/api/meetings'
import { getEmployees } from '@/lib/api/employees'
import type { MeetingDecision } from '@/lib/types/meetings'
import { fmtDate } from '@/components/meetings/shared'

const inputClass = 'border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB]'

export default function DecisionLogPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''
  const [decisions, setDecisions] = useState<MeetingDecision[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(() => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    meetingsApi.decisionLog(orgId, { search: search || undefined, from_date: from || undefined, to_date: to || undefined })
      .then(setDecisions).catch(() => setDecisions([])).finally(() => setLoading(false))
  }, [orgId, search, from, to])

  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t) }, [load, search])
  useEffect(() => { if (orgId) getEmployees(orgId).then((emps: any[]) => setNames(new Map(emps.map((e) => [e.user_id, e.user?.name ?? 'Unknown'])))).catch(() => {}) }, [orgId])

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-[26px] font-bold text-[#0F172A] leading-tight"><Gavel size={24} className="text-[#2563EB]" /> Decision Log</h1>
        <p className="text-sm text-[#475569] mt-1">Every decision recorded across meetings, with a line of sight back to where it was made.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input className={`${inputClass} w-full pl-9`} placeholder="Search decisions…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden">
        {loading ? <div className="p-10 text-center text-sm text-[#475569]">Loading…</div>
          : decisions.length === 0 ? <div className="p-10 text-center text-sm text-[#475569]">No decisions logged.</div>
          : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">Decision</th>
                  <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Owner</th>
                  <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3 hidden md:table-cell">Date</th>
                  <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">Meeting</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={d.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <p className="text-[15px] text-[#0F172A] font-medium">{d.decision}</p>
                      {d.reason && <p className="text-xs text-[#64748B] mt-0.5">{d.reason}</p>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-sm text-[#1E293B]">{d.owner_user_id ? names.get(d.owner_user_id) ?? '—' : '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-[#475569]">{fmtDate(d.decided_on)}</td>
                    <td className="px-4 py-3">
                      {d.meeting ? <button onClick={() => router.push(`/dashboard/governance/meetings/${d.meeting!.id}`)} className="text-sm text-[#2563EB] hover:underline">{d.meeting.title}</button> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}
