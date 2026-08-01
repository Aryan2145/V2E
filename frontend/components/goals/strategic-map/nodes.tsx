'use client'

import { createContext, useContext } from 'react'
import { ChevronRight, User, CalendarDays, Target, GitBranch } from 'lucide-react'
import { PERSPECTIVE_META, type Goal } from '@/lib/types/goals'
import { GoalStatusBadge, ProgressBar, formatDate } from '../shared'
import Tooltip from '@/components/ui/Tooltip'

// Slate accent for objectives.
const OBJECTIVE_STYLE = { accent: '#334155', text: '#334155' }

// ─── Interaction context ────────────────────────────────────────────────────────
// Card body navigates (onOpen); the sub-goal pill toggles (onToggle).

interface MapHandlers {
  onOpen: (goalId: string) => void
  onToggle: (goalId: string) => void
}
const MapCtx = createContext<MapHandlers>({ onOpen: () => {}, onToggle: () => {} })
export const StrategyMapProvider = MapCtx.Provider
const useMapHandlers = () => useContext(MapCtx)

// ─── Objective ───────────────────────────────────────────────────────────────────

export function ObjectiveCard({ goal, goalCount }: { goal: Goal; goalCount: number }) {
  const { onOpen } = useMapHandlers()
  const s = OBJECTIVE_STYLE
  return (
    <div
      onClick={() => onOpen(goal.id)}
      className="w-full h-full rounded-[12px] border bg-white shadow-sm px-3.5 py-3 cursor-pointer transition-shadow hover:shadow-md flex gap-2.5 overflow-hidden"
      style={{ borderColor: '#CBD5E1' }}
    >
      <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: s.accent }} />
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 mb-1">
          <Target size={13} style={{ color: s.accent }} />
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: s.text }}>
            Objective
          </span>
        </div>
        <p className="text-[15px] font-semibold text-[#0F172A] leading-snug line-clamp-3">{goal.title}</p>
        <div className="mt-auto pt-2">
          <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1.5">
            <span className="inline-flex items-center gap-1 min-w-0">
              <User size={12} className="text-[#94A3B8] shrink-0" />
              <span className="truncate">{goal.owner?.name ?? '—'}</span>
            </span>
            <span className="text-[#CBD5E1]">·</span>
            <span className="whitespace-nowrap">{goalCount} goal{goalCount === 1 ? '' : 's'}</span>
          </div>
          <ProgressBar value={goal.progress_percent} />
        </div>
      </div>
    </div>
  )
}

// ─── Goal ─────────────────────────────────────────────────────────────────────────

export function GoalCard({
  goal,
  subCount,
  expanded,
  toggleable,
}: {
  goal: Goal
  subCount: number
  expanded: boolean
  toggleable: boolean
}) {
  const { onOpen, onToggle } = useMapHandlers()
  const accent = PERSPECTIVE_META[goal.perspective ?? 'internal_process'].accent
  return (
    <div
      onClick={() => onOpen(goal.id)}
      className="group w-full h-full rounded-[11px] border bg-white shadow-sm px-3 py-2.5 cursor-pointer transition-shadow hover:shadow-md flex gap-2.5 overflow-hidden"
      style={{ borderColor: '#E2E8F0' }}
    >
      <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: accent }} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[#0F172A] leading-snug line-clamp-2">{goal.title}</p>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#64748B]">
          <User size={11} className="text-[#94A3B8] shrink-0" />
          <span className="truncate">{goal.owner?.name ?? '—'}</span>
          <span className="text-[#CBD5E1]">·</span>
          <CalendarDays size={11} className="text-[#94A3B8] shrink-0" />
          <span className="whitespace-nowrap">{formatDate(goal.due_date)}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 min-w-0">
            <ProgressBar value={goal.progress_percent} />
          </div>
          <GoalStatusBadge status={goal.status} />
        </div>
        {subCount > 0 && (
          <Tooltip label={toggleable ? (expanded ? 'Hide sub-goals' : 'Show sub-goals') : 'Use the master switch to toggle all'}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(goal.id) }}
              disabled={!toggleable}
              className={`mt-2 inline-flex items-center gap-1 rounded-[6px] border px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                expanded
                  ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                  : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]'
              } ${toggleable ? '' : 'cursor-default opacity-90'}`}
            >
              <ChevronRight size={11} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
              {subCount} sub-goal{subCount === 1 ? '' : 's'}
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

// ─── Sub-goal ───────────────────────────────────────────────────────────────────

export function SubGoalCard({ goal, crossPerspective }: { goal: Goal; crossPerspective: boolean }) {
  const { onOpen } = useMapHandlers()
  const p = goal.perspective ?? 'internal_process'
  const accent = PERSPECTIVE_META[p].accent
  return (
    <div
      onClick={() => onOpen(goal.id)}
      className="w-full h-full rounded-[10px] border bg-white shadow-sm px-3 py-2 cursor-pointer transition-shadow hover:shadow-md flex gap-2 overflow-hidden"
      style={{ borderColor: '#E8EDF3' }}
    >
      <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: accent }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: PERSPECTIVE_META[p].text }}>
            Sub-goal
          </span>
          {crossPerspective && (
            <Tooltip label={`Different perspective from its parent goal · ${PERSPECTIVE_META[p].label}`}>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#94A3B8]">
                <GitBranch size={10} /> {PERSPECTIVE_META[p].short}
              </span>
            </Tooltip>
          )}
        </div>
        <p className="text-[13px] font-medium text-[#0F172A] leading-snug line-clamp-2">{goal.title}</p>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#64748B]">
          <User size={10} className="text-[#94A3B8] shrink-0" />
          <span className="truncate">{goal.owner?.name ?? '—'}</span>
        </div>
      </div>
    </div>
  )
}
