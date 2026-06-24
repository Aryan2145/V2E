'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, CalendarOff } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/components/ui/Toast'
import DatePicker from '@/components/ui/DatePicker'
import LeaveStateBadge from '@/components/leave/LeaveStateBadge'
import { leaveApi } from '@/lib/api/leave'
import type { Leave } from '@/lib/types/leave'

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MyLeavePage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const { addToast } = useToast()

  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [declare, setDeclare] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const todayStr = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    if (!orgId) return
    setLeaves(await leaveApi.mine(orgId))
  }, [orgId])

  useEffect(() => {
    setLoading(true)
    load().catch(() => addToast('Could not load your leave', 'error')).finally(() => setLoading(false))
  }, [load, addToast])

  async function apply() {
    if (!start || !end) { addToast('Pick a start and end date', 'error'); return }
    if (end < start) { addToast('End date cannot be before start date', 'error'); return }
    setSubmitting(true)
    try {
      await leaveApi.apply(orgId, { start_date: start, end_date: end, reason: reason.trim() || undefined, declare })
      setStart(''); setEnd(''); setReason(''); setDeclare(false)
      addToast(declare ? 'Leave declared' : 'Leave submitted', 'success')
      await load()
    } catch (e: any) {
      const m = e?.response?.data?.message ?? 'Could not submit leave'
      addToast(Array.isArray(m) ? m.join(', ') : m, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn()
      addToast(ok, 'success')
      await load()
    } catch (e: any) {
      const m = e?.response?.data?.message ?? 'Action failed'
      addToast(Array.isArray(m) ? m.join(', ') : m, 'error')
    }
  }

  const cardCls = 'bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5'

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-[22px] font-semibold text-[#0F172A]">My Leave</h1>

      {/* Apply */}
      <div className={cardCls}>
        <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Apply for leave</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">From</label>
            <DatePicker value={start} onChange={setStart} min={todayStr} placeholder="Start date" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">To</label>
            <DatePicker value={end} onChange={setEnd} min={start || todayStr} placeholder="End date" />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Reason (optional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Family function"
            className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
          />
        </div>
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input type="checkbox" checked={declare} onChange={(e) => setDeclare(e.target.checked)} className="accent-[#2563EB]" />
          <span className="text-sm text-[#1E293B]">Declare as unplanned leave (e.g. sick) — book now without waiting for approval</span>
        </label>
        <button
          type="button"
          onClick={apply}
          disabled={submitting}
          className="mt-4 flex items-center gap-2 px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {submitting ? 'Submitting…' : declare ? 'Declare leave' : 'Submit request'}
        </button>
      </div>

      {/* My leave list */}
      <div className={cardCls}>
        <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">My leave</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[#475569]"><Loader2 size={14} className="animate-spin" /> Loading…</div>
        ) : leaves.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-8">
            <CalendarOff size={22} className="text-[#94A3B8]" />
            <p className="text-sm text-[#0F172A] font-medium">No leave yet</p>
            <p className="text-xs text-[#475569]">Apply for leave using the form above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaves.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 p-3 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#0F172A]">{fmt(l.start_date)} → {fmt(l.end_date)}</span>
                    <LeaveStateBadge leave={l} />
                  </div>
                  {l.reason && <p className="text-xs text-[#475569] mt-1">{l.reason}</p>}
                  {l.state === 'rejected' && l.decision_note && (
                    <p className="text-xs text-[#DC2626] mt-1">Reason: {l.decision_note}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {l.state === 'rejected' && !l.overridden && (
                    <button
                      type="button"
                      onClick={() => act(() => leaveApi.override(orgId, l.id), 'Leave taken anyway')}
                      className="text-xs font-semibold text-[#7C3AED] border border-[#DDD6FE] bg-[#F5F3FF] rounded-[6px] px-2.5 py-1 hover:bg-[#EDE9FE] transition-colors"
                    >
                      Take anyway
                    </button>
                  )}
                  {l.state !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => act(() => leaveApi.cancel(orgId, l.id), 'Leave cancelled')}
                      className="text-xs font-semibold text-[#475569] border border-[#CBD5E1] rounded-[6px] px-2.5 py-1 hover:bg-[#F1F5F9] transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
