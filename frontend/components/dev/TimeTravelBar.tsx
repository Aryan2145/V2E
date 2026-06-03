'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Clock, ChevronLeft, ChevronRight, Play, RotateCcw, FlaskConical } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { clockApi } from '@/lib/api/clock'
import { syncClock, useNow } from '@/lib/clock'

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Floating "time travel" control for test organizations. Picker / typing / arrows
 * only edit a LOCAL pending value (no API calls). Apply commits once → backend
 * replays the gap → full reload so every view reflects the new simulated time.
 */
export default function TimeTravelBar() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const isTestOrg = !!user?.isTestOrg

  const now = useNow() // live ticking display
  const [pending, setPending] = useState<string>('') // datetime-local string (local pending only)
  const [synced, setSynced] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Initial fetch + periodic re-sync (keeps drift corrected). No writes here.
  const refresh = useCallback(async () => {
    if (!orgId) return
    try {
      const state = await clockApi.getClock(orgId)
      syncClock(state)
      setSynced(true)
      // Seed the pending field only once (don't fight the user while they type)
      setPending((prev) => prev || toLocalInput(new Date(state.simulated_now)))
    } catch {
      /* ignore — bar stays on real time */
    }
  }, [orgId])

  useEffect(() => {
    if (!isTestOrg) return
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [isTestOrg, refresh])

  if (!isTestOrg || !orgId) return null

  const nudgeDays = (delta: number) => {
    const base = pending ? new Date(pending) : new Date(now)
    base.setDate(base.getDate() + delta)
    setPending(toLocalInput(base))
  }
  const nudgeHours = (delta: number) => {
    const base = pending ? new Date(pending) : new Date(now)
    base.setHours(base.getHours() + delta)
    setPending(toLocalInput(base))
  }

  async function apply() {
    if (!pending) return
    setBusy(true)
    setError('')
    try {
      const iso = new Date(pending).toISOString()
      const state = await clockApi.setClock(orgId, iso)
      syncClock(state)
      // Full reload so all client-fetched views reflect the new simulated time.
      window.location.reload()
    } catch {
      setError('Failed to set clock')
      setBusy(false)
    }
  }

  async function reset() {
    setBusy(true)
    setError('')
    try {
      const state = await clockApi.resetClock(orgId)
      syncClock(state)
      window.location.reload()
    } catch {
      setError('Failed to reset clock')
      setBusy(false)
    }
  }

  const liveLabel = now.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  const inputCls = 'px-2.5 py-1.5 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] bg-white focus:border-[#2563EB] focus:outline-none'
  const arrowCls = 'w-8 h-8 flex items-center justify-center rounded-[8px] bg-white border border-[#FBBF24] text-[#92400E] hover:bg-[#FFFBEB] transition-colors'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-[#D97706] bg-[#FEF3C7] shadow-[0_-2px_12px_rgba(0,0,0,0.10)]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        {/* Badge + live clock */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-[999px] bg-[#D97706] px-2.5 py-1 text-[12px] font-semibold text-white">
            <FlaskConical size={13} /> TEST CLOCK
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#92400E]">
            <Clock size={14} /> {liveLabel}
          </span>
        </div>

        <div className="h-5 w-px bg-[#FBBF24]" />

        {/* Pending value editor (local only) */}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => nudgeDays(-1)} title="−1 day" className={arrowCls}>
            <ChevronLeft size={16} />
          </button>
          <input
            type="datetime-local"
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            className={inputCls}
          />
          <button type="button" onClick={() => nudgeDays(1)} title="+1 day" className={arrowCls}>
            <ChevronRight size={16} />
          </button>
          <div className="flex items-center gap-1 ml-1">
            <button type="button" onClick={() => nudgeHours(-1)} className="px-2 h-8 rounded-[8px] bg-white border border-[#FBBF24] text-[#92400E] text-xs font-semibold hover:bg-[#FFFBEB]">−1h</button>
            <button type="button" onClick={() => nudgeHours(1)} className="px-2 h-8 rounded-[8px] bg-white border border-[#FBBF24] text-[#92400E] text-xs font-semibold hover:bg-[#FFFBEB]">+1h</button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {error && <span className="text-sm font-medium text-[#DC2626]">{error}</span>}
          <button
            type="button"
            onClick={apply}
            disabled={busy || !pending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
          >
            <Play size={14} /> {busy ? 'Applying…' : 'Apply'}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-semibold text-[#92400E] bg-white border border-[#D97706] hover:bg-[#FFFBEB] disabled:text-[#94A3B8] disabled:border-[#E2E8F0] transition-colors"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>
      {!synced && (
        <div className="px-4 pb-1 text-[11px] text-[#92400E]">Connecting to simulated clock…</div>
      )}
    </div>
  )
}
