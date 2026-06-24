'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Check, X, Inbox } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/components/ui/Toast'
import { leaveApi } from '@/lib/api/leave'
import type { Leave } from '@/lib/types/leave'

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ApprovalsPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const { addToast } = useToast()

  const [pending, setPending] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    setPending(await leaveApi.approvals(orgId))
  }, [orgId])

  useEffect(() => {
    setLoading(true)
    load().catch(() => addToast('Could not load approvals', 'error')).finally(() => setLoading(false))
  }, [load, addToast])

  async function decide(id: string, decision: 'approved' | 'rejected') {
    let note: string | undefined
    if (decision === 'rejected') {
      note = window.prompt('Reason for rejection (optional):') ?? undefined
    }
    setBusy(id)
    try {
      await leaveApi.decide(orgId, id, { decision, note })
      addToast(decision === 'approved' ? 'Leave approved' : 'Leave rejected', 'success')
      await load()
    } catch (e: any) {
      const m = e?.response?.data?.message ?? 'Action failed'
      addToast(Array.isArray(m) ? m.join(', ') : m, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-[22px] font-semibold text-[#0F172A]">Leave Approvals</h1>

      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[#475569]"><Loader2 size={14} className="animate-spin" /> Loading…</div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-8">
            <Inbox size={22} className="text-[#94A3B8]" />
            <p className="text-sm text-[#0F172A] font-medium">No pending requests</p>
            <p className="text-xs text-[#475569]">Leave requests you can approve will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 p-3 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC]">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F172A]">{l.applicant_name ?? 'Employee'}</p>
                  <p className="text-xs text-[#475569] mt-0.5">{fmt(l.start_date)} → {fmt(l.end_date)}</p>
                  {l.reason && <p className="text-xs text-[#475569] mt-1">“{l.reason}”</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busy === l.id}
                    onClick={() => decide(l.id, 'approved')}
                    className="flex items-center gap-1 text-xs font-semibold text-white bg-[#16A34A] rounded-[6px] px-2.5 py-1.5 hover:bg-[#15803D] disabled:opacity-50 transition-colors"
                  >
                    <Check size={13} /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy === l.id}
                    onClick={() => decide(l.id, 'rejected')}
                    className="flex items-center gap-1 text-xs font-semibold text-[#DC2626] border border-[#FECACA] bg-white rounded-[6px] px-2.5 py-1.5 hover:bg-[#FEF2F2] disabled:opacity-50 transition-colors"
                  >
                    <X size={13} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
