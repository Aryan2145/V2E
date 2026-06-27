'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CornerDownRight, User, CalendarDays, Target } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { goalsApi } from '@/lib/api/goals'
import { LEVEL_META, PERSPECTIVE_META, type Goal, type GoalPerspective } from '@/lib/types/goals'
import { GoalStatusBadge, ProgressBar, formatDate } from '@/components/goals/shared'

const ORDER: GoalPerspective[] = ['financial', 'customer', 'internal_process', 'learning_growth']
const LEVEL_RANK: Record<string, number> = { annual: 0, quarterly: 1, objective: 2 }

function ProgressRing({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const r = 24
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="relative w-[60px] h-[60px] shrink-0">
      <svg width="60" height="60" className="-rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="#F1F5F9" strokeWidth="7" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-[#0F172A] tabular-nums">
        {pct}%
      </span>
    </div>
  )
}

export default function ScorecardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    goalsApi
      .list(orgId, {})
      .then(setGoals)
      .catch(() => setGoals([]))
      .finally(() => setLoading(false))
  }, [orgId])

  // Resolve each goal's parent (for the line-of-sight chip) from the same set.
  const byId = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals])

  const groups = useMemo(() => {
    return ORDER.map((p) => {
      const items = goals
        .filter((g) => g.perspective === p)
        .sort((a, b) => {
          const r = (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9)
          return r !== 0 ? r : a.due_date.localeCompare(b.due_date)
        })
      const goalCount = items.filter((g) => g.level === 'annual').length
      const subCount = items.filter((g) => g.level === 'quarterly').length
      const avg = items.length
        ? Math.round(items.reduce((s, g) => s + g.progress_percent, 0) / items.length)
        : 0
      return { perspective: p, items, goalCount, subCount, avg }
    })
  }, [goals])

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight">Balanced Scorecard</h1>
        <p className="text-sm text-[#475569] mt-1">
          Goals and sub-goals across the four perspectives, with their line of sight up to the parent.
        </p>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-[#475569]">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groups.map(({ perspective: p, items, goalCount, subCount, avg }) => {
            const m = PERSPECTIVE_META[p]
            return (
              <div
                key={p}
                className="flex flex-col bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden h-[440px]"
                style={{ borderTopWidth: 4, borderTopColor: m.accent }}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3 border-b border-[#F1F5F9] shrink-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: m.accent }} />
                      <h2 className="text-[17px] font-semibold text-[#0F172A] truncate">{m.label}</h2>
                    </div>
                    <p className="text-xs text-[#64748B]">
                      <span className="font-semibold text-[#0F172A]">{goalCount}</span> goal{goalCount === 1 ? '' : 's'}
                      <span className="text-[#94A3B8]"> · </span>
                      <span className="font-semibold text-[#0F172A]">{subCount}</span> sub-goal{subCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <ProgressRing value={avg} color={m.accent} />
                </div>

                {/* Line items */}
                <div className="flex-1 overflow-y-auto px-3 py-2.5">
                  {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-2">
                      <span className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8]">
                        <Target size={16} />
                      </span>
                      <p className="text-sm text-[#94A3B8]">No goals in this perspective yet.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {items.map((g) => (
                        <LineItem
                          key={g.id}
                          goal={g}
                          parent={g.parent_goal_id ? byId.get(g.parent_goal_id) : undefined}
                          accent={m.accent}
                          onClick={() => router.push(`/goals/${g.id}`)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer link */}
                <button
                  type="button"
                  onClick={() => router.push(`/goals/annual?perspective=${p}`)}
                  className="group flex items-center justify-center gap-1.5 px-5 py-2.5 border-t border-[#F1F5F9] text-sm font-medium text-[#2563EB] hover:bg-[#F8FAFC] shrink-0 transition-colors"
                >
                  Open {m.label} goals <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LineItem({
  goal,
  parent,
  accent,
  onClick,
}: {
  goal: Goal
  parent?: Goal
  accent: string
  onClick: () => void
}) {
  // The chip reflects the PARENT's own perspective. Objectives carry none, so an
  // annual goal's chip shows just the objective title (no perspective tag).
  const parentPerspective = parent?.perspective ? PERSPECTIVE_META[parent.perspective] : null
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left flex items-start gap-2.5 rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2.5 hover:border-[#CBD5E1] hover:bg-[#F8FAFC] transition-colors"
    >
      <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: accent }} />

      <div className="flex-1 min-w-0">
        {/* Title + level */}
        <p className="text-[15px] text-[#0F172A] truncate">
          <span className="font-semibold">{goal.title}</span>
          <span className="text-[#94A3B8] font-medium"> · {LEVEL_META[goal.level].label.toLowerCase()}</span>
        </p>

        {/* Line-of-sight chip → parent · perspective */}
        {parent && (
          <span className="inline-flex items-center gap-1 mt-1.5 max-w-full rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-xs text-[#475569]">
            <CornerDownRight size={12} className="text-[#94A3B8] shrink-0" />
            <span className="truncate">{parent.title}</span>
            {parentPerspective && <span className="text-[#94A3B8] shrink-0">· {parentPerspective.label}</span>}
          </span>
        )}

        {/* Basic details */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-[#64748B]">
          <span className="inline-flex items-center gap-1">
            <User size={12} className="text-[#94A3B8]" /> {goal.owner?.name ?? '—'}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} className="text-[#94A3B8]" /> {formatDate(goal.due_date)}
          </span>
          <GoalStatusBadge status={goal.status} />
        </div>
      </div>

      {/* Progress */}
      <div className="w-24 shrink-0 mt-1 hidden sm:block">
        <ProgressBar value={goal.progress_percent} />
      </div>
    </button>
  )
}
