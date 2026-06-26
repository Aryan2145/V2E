'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2, ArrowUpRight, ListChecks } from 'lucide-react'
import { goalsApi } from '@/lib/api/goals'
import { LEVEL_META, type Goal, type GoalLevel } from '@/lib/types/goals'
import { GoalStatusBadge, PerspectiveBadge, ProgressBar, formatDate } from './shared'

// Cascading, in-place drill-down for a goal hierarchy:
//   Objective → Goals → Sub-goals → Tasks
// Each node lazy-loads its own children/tasks on first expand (via goalsApi.get,
// which returns immediate `children` and, for quarterly goals, linked `tasks`).
// Tree connector lines + per-level colour make the nesting visually explicit.

// ─── Layout + colour constants ──────────────────────────────────────────────────

const INDENT = 28        // px of left room each nested level gets (holds the connector)
const SPINE_X = 13       // x of the vertical guide line within that room
const ELBOW_Y = 34       // y of the horizontal joint (≈ vertical centre of a row)
const ROW_PT = 8         // top gap above each child row (keeps the spine continuous)

interface LevelStyle {
  accent: string  // connector + accent-bar colour
  tint: string    // faint row background
  text: string    // level-label text colour
}

const LEVEL_STYLE: Record<GoalLevel, LevelStyle> = {
  objective: { accent: '#0F172A', tint: '#FFFFFF', text: '#0F172A' },
  annual: { accent: '#2563EB', tint: '#F5F8FF', text: '#2563EB' },
  quarterly: { accent: '#7C3AED', tint: '#FAF7FF', text: '#7C3AED' },
}
const TASK_STYLE = { accent: '#0891B2', tint: '#F2FBFC', text: '#0E7490' }

// ─── Public entry ────────────────────────────────────────────────────────────────

export default function GoalCascade({ orgId, goals }: { orgId: string; goals: Goal[] }) {
  return (
    <div className="flex flex-col gap-2">
      {goals.map((g) => (
        <GoalNode key={g.id} orgId={orgId} goal={g} depth={0} />
      ))}
    </div>
  )
}

// ─── Connector wrapper (draws the spine + elbow joining a child to its parent) ────

function Connector({
  color,
  isLast,
  children,
}: {
  color: string
  isLast: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative" style={{ paddingTop: ROW_PT }}>
      {/* vertical spine — full height for middle children, stops at the elbow for the last */}
      <span
        aria-hidden
        className="absolute rounded-full"
        style={{
          left: SPINE_X - INDENT,
          top: 0,
          width: 2,
          height: isLast ? ELBOW_Y : '100%',
          backgroundColor: color,
          opacity: 0.4,
        }}
      />
      {/* horizontal elbow into the row */}
      <span
        aria-hidden
        className="absolute rounded-full"
        style={{
          left: SPINE_X - INDENT,
          top: ELBOW_Y,
          width: INDENT - SPINE_X - 2,
          height: 2,
          backgroundColor: color,
          opacity: 0.4,
        }}
      />
      {children}
    </div>
  )
}

// ─── Goal node ───────────────────────────────────────────────────────────────────

function GoalNode({ orgId, goal, depth }: { orgId: string; goal: Goal; depth: number }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [children, setChildren] = useState<Goal[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [error, setError] = useState(false)

  const isQuarterly = goal.level === 'quarterly'
  const hasChildGoals = (goal._count?.children ?? 0) > 0
  // Sub-goals (quarterly) drill into their tasks; higher levels drill into child
  // goals. Quarterly is always expandable so its tasks stay reachable.
  const expandable = isQuarterly || hasChildGoals
  const childMeta = LEVEL_META[goal.level].child
  const style = LEVEL_STYLE[goal.level]

  const ensureLoaded = useCallback(async () => {
    if (loaded || loading) return
    setLoading(true)
    setError(false)
    try {
      const full = await goalsApi.get(orgId, goal.id)
      setChildren(full.children ?? [])
      setTasks(full.tasks ?? [])
      setLoaded(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [loaded, loading, orgId, goal.id])

  function toggle() {
    if (!expandable) return
    const next = !expanded
    setExpanded(next)
    if (next && !loaded) void ensureLoaded()
  }

  return (
    <div>
      {/* Row */}
      <div
        className={`group relative flex items-center gap-2.5 rounded-[10px] border border-[#E2E8F0] pl-2.5 pr-3 py-2.5 transition-colors ${
          expandable ? 'hover:border-[#CBD5E1] cursor-pointer' : ''
        }`}
        style={{ backgroundColor: style.tint }}
        onClick={toggle}
      >
        {/* Level accent bar */}
        <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: style.accent }} />

        {/* Expand chevron */}
        {expandable ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggle() }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            className="w-5 h-5 flex items-center justify-center rounded-[5px] text-[#64748B] hover:bg-white shrink-0"
          >
            <ChevronRight size={15} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[#0F172A] truncate">{goal.title}</p>
          <p className="text-xs mt-0.5 truncate">
            <span className="font-semibold" style={{ color: style.text }}>{LEVEL_META[goal.level].label}</span>
            <span className="text-[#64748B]"> · {goal.owner?.name ?? '—'} · due {formatDate(goal.due_date)}</span>
            {hasChildGoals && childMeta && (
              <span className="text-[#94A3B8]"> · {goal._count?.children} {LEVEL_META[childMeta].plural.toLowerCase()}</span>
            )}
          </p>
        </div>

        {/* Badges + progress */}
        <PerspectiveBadge perspective={goal.perspective} />
        <GoalStatusBadge status={goal.status} />
        <div className="w-28 hidden md:block">
          <ProgressBar value={goal.progress_percent} />
        </div>

        {/* Open full page */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); router.push(`/goals/${goal.id}`) }}
          aria-label="Open"
          title="Open full page"
          className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#2563EB] hover:bg-white shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ArrowUpRight size={15} />
        </button>
      </div>

      {/* Expanded content — nested under the row with a connector spine */}
      {expanded && (
        <div className="relative" style={{ paddingLeft: INDENT }}>
          {loading && !loaded ? (
            <div className="flex items-center gap-2 text-sm text-[#64748B]" style={{ paddingTop: ROW_PT }}>
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : error ? (
            <button
              type="button"
              onClick={() => void ensureLoaded()}
              className="text-sm text-[#DC2626] hover:underline"
              style={{ paddingTop: ROW_PT }}
            >
              Couldn&apos;t load — retry
            </button>
          ) : (
            <>
              {/* Child goals (down a level) */}
              {children.map((c, i) => (
                <Connector key={c.id} color={LEVEL_STYLE[c.level].accent} isLast={i === children.length - 1}>
                  <GoalNode orgId={orgId} goal={c} depth={depth + 1} />
                </Connector>
              ))}

              {/* Tasks (leaf, quarterly only) */}
              {isQuarterly &&
                tasks.map((t, i) => (
                  <Connector key={t.id} color={TASK_STYLE.accent} isLast={i === tasks.length - 1}>
                    <TaskRow task={t} />
                  </Connector>
                ))}

              {/* Empty state */}
              {loaded && !loading &&
                (isQuarterly ? tasks.length === 0 : children.length === 0) && (
                  <p className="text-sm text-[#94A3B8]" style={{ paddingTop: ROW_PT }}>
                    {isQuarterly
                      ? 'No initiatives (tasks) linked yet.'
                      : childMeta
                        ? `No ${LEVEL_META[childMeta].plural.toLowerCase()} yet.`
                        : 'Nothing here yet.'}
                  </p>
                )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Task row (leaf) ─────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: any }) {
  const status = task.status as { name?: string; color?: string } | undefined
  return (
    <div
      className="flex items-center gap-2.5 rounded-[10px] border border-[#E2E8F0] pl-2.5 pr-3 py-2"
      style={{ backgroundColor: TASK_STYLE.tint }}
    >
      <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: TASK_STYLE.accent }} />
      <span className="w-5 h-5 flex items-center justify-center shrink-0" style={{ color: TASK_STYLE.text }}>
        <ListChecks size={13} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F172A] truncate">{task.title}</p>
        <p className="text-xs mt-0.5 truncate">
          <span className="font-semibold" style={{ color: TASK_STYLE.text }}>Task</span>
          {task.deadline && <span className="text-[#64748B]"> · due {formatDate(task.deadline)}</span>}
        </p>
      </div>
      {status?.name && (
        <span
          className="text-[12px] font-medium rounded-full px-2.5 py-0.5 border whitespace-nowrap shrink-0"
          style={{
            backgroundColor: status.color ? `${status.color}1A` : '#F1F5F9',
            color: status.color ?? '#475569',
            borderColor: '#E2E8F0',
          }}
        >
          {status.name}
        </span>
      )}
    </div>
  )
}
