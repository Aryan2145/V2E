'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { goalsApi } from '@/lib/api/goals'
import { PERSPECTIVE_META, type GoalPerspective, type ScorecardQuadrant } from '@/lib/types/goals'

const ORDER: GoalPerspective[] = ['financial', 'customer', 'internal_process', 'learning_growth']

function ProgressRing({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const r = 30
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="relative w-[76px] h-[76px] shrink-0">
      <svg width="76" height="76" className="-rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="#F1F5F9" strokeWidth="8" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold text-[#0F172A] tabular-nums">
        {pct}%
      </span>
    </div>
  )
}

export default function ScorecardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''
  const [quadrants, setQuadrants] = useState<ScorecardQuadrant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    goalsApi
      .scorecard(orgId)
      .then(setQuadrants)
      .catch(() => setQuadrants([]))
      .finally(() => setLoading(false))
  }, [orgId])

  const byPerspective = new Map(quadrants.map((q) => [q.perspective, q]))

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight">Balanced Scorecard</h1>
        <p className="text-sm text-[#475569] mt-1">
          Goals across the four perspectives. Click a quadrant to drill into its goals.
        </p>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-[#475569]">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ORDER.map((p) => {
            const m = PERSPECTIVE_META[p]
            const q = byPerspective.get(p) ?? { perspective: p, goal_count: 0, average_progress: 0 }
            return (
              <button
                key={p}
                onClick={() => router.push(`/goals/annual?perspective=${p}`)}
                className="group text-left bg-white border border-[#E2E8F0] rounded-[12px] p-6 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-[#CBD5E1] transition-all"
                style={{ borderTopWidth: 4, borderTopColor: m.accent }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.accent }} />
                      <h2 className="text-[18px] font-semibold text-[#0F172A]">{m.label}</h2>
                    </div>
                    <p className="text-[34px] font-bold text-[#0F172A] leading-none mt-3">{q.goal_count}</p>
                    <p className="text-sm text-[#475569] mt-1">
                      goal{q.goal_count === 1 ? '' : 's'}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] mt-4 group-hover:gap-2 transition-all">
                      View goals <ArrowRight size={15} />
                    </span>
                  </div>
                  <ProgressRing value={q.average_progress} color={m.accent} />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
