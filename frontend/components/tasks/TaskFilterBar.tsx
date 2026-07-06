'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Filter, ChevronDown, Check, Minus } from 'lucide-react'
import StyledSelect from '@/components/ui/StyledSelect'
import type { Task, TaskCategory, TaskPriority, TaskStatus } from '@/lib/types/tasks'
import { TERMINAL_STATUS_PHASES } from '@/lib/types/tasks'

// The status filter is a multi-select with two presets:
//  - 'open'  (default) → every non-terminal status (Not started / In progress / …)
//  - 'all'            → every status, open AND closed
//  - 'custom'         → the explicit `statusIds` set (any hand-picked combination)
// Overdue is a SEPARATE axis (a task can be overdue while still open), so it has
// its own dropdown rather than living inside the status list.
export type StatusMode = 'open' | 'all' | 'custom'
export type OverdueFilter = 'all' | 'overdue' | 'not_overdue'

export interface TaskFilters {
  statusMode: StatusMode
  /** Only meaningful when statusMode === 'custom'. */
  statusIds: string[]
  overdue: OverdueFilter
  priority: string
  category: string
  user: string
}

// Default view: Open tasks, any deadline. Closed tasks are hidden until the user
// opts into them (Closed section or "All statuses").
export const EMPTY_TASK_FILTERS: TaskFilters = {
  statusMode: 'open',
  statusIds: [],
  overdue: 'all',
  priority: 'all',
  category: 'all',
  user: 'all',
}

export function isTaskFiltered(f: TaskFilters): boolean {
  return (
    f.statusMode !== 'open' ||
    f.overdue !== 'all' ||
    f.priority !== 'all' ||
    f.category !== 'all' ||
    f.user !== 'all'
  )
}

function statusTypeOf(t: Task, statuses: TaskStatus[]): TaskStatus['type'] | undefined {
  return statuses.find((s) => s.id === t.status_id)?.type ?? t.status?.type
}

function matchesStatus(t: Task, f: TaskFilters, statuses: TaskStatus[]): boolean {
  if (f.statusMode === 'all') return true
  if (f.statusMode === 'open') {
    const type = statusTypeOf(t, statuses)
    return !!type && !TERMINAL_STATUS_PHASES.includes(type)
  }
  return f.statusIds.includes(t.status_id)
}

function matchesOverdue(t: Task, mode: OverdueFilter): boolean {
  if (mode === 'all') return true
  return mode === 'overdue' ? !!t.is_overdue : !t.is_overdue
}

export function applyTaskFilters(tasks: Task[], f: TaskFilters, statuses: TaskStatus[]): Task[] {
  return tasks.filter((t) =>
    matchesStatus(t, f, statuses) &&
    matchesOverdue(t, f.overdue) &&
    (f.priority === 'all' || t.priority_id === f.priority) &&
    (f.category === 'all' || t.category_id === f.category) &&
    (f.user === 'all' || (t.assignees ?? []).some((a) => a.user_id === f.user)),
  )
}

// ─── Status multi-select ────────────────────────────────────────────────────────

function CheckBox({ checked, indeterminate }: { checked: boolean; indeterminate?: boolean }) {
  const on = checked || indeterminate
  return (
    <span
      className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
        on ? 'bg-[#2563EB] border-[#2563EB]' : 'bg-white border-[#CBD5E1]'
      }`}
    >
      {checked ? (
        <Check size={12} className="text-white" strokeWidth={3} />
      ) : indeterminate ? (
        <Minus size={12} className="text-white" strokeWidth={3} />
      ) : null}
    </span>
  )
}

/**
 * Multi-select status filter. Statuses are grouped into Open / Closed sections,
 * each with a section-level toggle; an "All statuses" switch selects everything.
 * The open panel is an in-flow absolute element (never a portal), so it moves with
 * the toolbar and never drifts — see memory `no-overflow-parent`.
 */
function StatusMultiSelect({
  statuses,
  filters,
  counts,
  onChange,
}: {
  statuses: TaskStatus[]
  filters: TaskFilters
  counts: Map<string, number>
  onChange: (f: TaskFilters) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openStatuses = useMemo(
    () => statuses.filter((s) => !TERMINAL_STATUS_PHASES.includes(s.type)).sort((a, b) => a.order_index - b.order_index),
    [statuses],
  )
  const closedStatuses = useMemo(
    () => statuses.filter((s) => TERMINAL_STATUS_PHASES.includes(s.type)).sort((a, b) => a.order_index - b.order_index),
    [statuses],
  )
  const allIds = useMemo(() => statuses.map((s) => s.id), [statuses])
  const openIds = useMemo(() => openStatuses.map((s) => s.id), [openStatuses])

  // The concrete set of currently-selected status ids, whatever the mode.
  const effective = useMemo<Set<string>>(() => {
    if (filters.statusMode === 'all') return new Set(allIds)
    if (filters.statusMode === 'open') return new Set(openIds)
    return new Set(filters.statusIds)
  }, [filters, allIds, openIds])

  // Persist a selection, collapsing back to a named preset when it matches one
  // exactly (keeps the label clean and the Clear button meaningful).
  const commit = (ids: Set<string>) => {
    const eq = (arr: string[]) => arr.length === ids.size && arr.every((id) => ids.has(id))
    if (allIds.length > 0 && eq(allIds)) onChange({ ...filters, statusMode: 'all', statusIds: [] })
    else if (openIds.length > 0 && eq(openIds)) onChange({ ...filters, statusMode: 'open', statusIds: [] })
    else onChange({ ...filters, statusMode: 'custom', statusIds: Array.from(ids) })
  }

  const toggleId = (id: string) => {
    const next = new Set(effective)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    commit(next)
  }

  const toggleGroup = (group: TaskStatus[]) => {
    const ids = group.map((s) => s.id)
    const allOn = ids.length > 0 && ids.every((id) => effective.has(id))
    const next = new Set(effective)
    if (allOn) ids.forEach((id) => next.delete(id))
    else ids.forEach((id) => next.add(id))
    commit(next)
  }

  const toggleAll = () => {
    if (filters.statusMode === 'all') onChange({ ...filters, statusMode: 'open', statusIds: [] })
    else onChange({ ...filters, statusMode: 'all', statusIds: [] })
  }

  const label =
    filters.statusMode === 'all'
      ? 'All statuses'
      : filters.statusMode === 'open'
        ? 'Open'
        : effective.size === 0
          ? 'No status'
          : `${effective.size} selected`

  const section = (title: string, group: TaskStatus[]) => {
    if (group.length === 0) return null
    const ids = group.map((s) => s.id)
    const selectedInGroup = ids.filter((id) => effective.has(id)).length
    const allOn = selectedInGroup === ids.length
    const someOn = selectedInGroup > 0 && !allOn
    return (
      <div>
        <button
          type="button"
          onClick={() => toggleGroup(group)}
          className="w-full flex items-center gap-2.5 px-3 pt-2 pb-1 hover:bg-[#F8FAFC] transition-colors"
        >
          <CheckBox checked={allOn} indeterminate={someOn} />
          <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{title}</span>
        </button>
        {group.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggleId(s.id)}
            className="w-full flex items-center gap-2.5 pl-8 pr-3 py-1.5 hover:bg-[#F8FAFC] transition-colors"
          >
            <CheckBox checked={effective.has(s.id)} />
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="flex-1 text-left text-sm text-[#0F172A] truncate">{s.label}</span>
            <span className="text-xs text-[#94A3B8] tabular-nums shrink-0">{counts.get(s.id) ?? 0}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative w-48">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-white hover:border-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] rounded-[8px] px-3 py-2.5 text-[15px] transition-colors"
      >
        <span className="flex-1 min-w-0 truncate text-left text-[#0F172A]">{label}</span>
        <ChevronDown size={16} className={`shrink-0 text-[#94A3B8] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 max-h-[340px] overflow-y-auto overscroll-contain rounded-[10px] border border-[#E2E8F0] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.14)] py-1"
        >
          <button
            type="button"
            onClick={toggleAll}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F8FAFC] transition-colors"
          >
            <CheckBox checked={filters.statusMode === 'all'} />
            <span className="flex-1 text-left text-sm font-semibold text-[#0F172A]">All statuses</span>
          </button>
          <div className="my-1 border-t border-[#E2E8F0]" />
          {section('Open', openStatuses)}
          {section('Closed', closedStatuses)}
        </div>
      )}
    </div>
  )
}

// ─── Filter bar ─────────────────────────────────────────────────────────────────

/**
 * Shared task filter toolbar: status (multi-select) / overdue / priority /
 * category / user, with live line-item counts on every option (counts respect the
 * other active filters, so the number always matches what selecting the option
 * would show).
 */
export default function TaskFilterBar({
  tasks,
  statuses,
  priorities,
  categories,
  filters,
  onChange,
}: {
  tasks: Task[]
  statuses: TaskStatus[]
  priorities: TaskPriority[]
  categories: TaskCategory[]
  filters: TaskFilters
  onChange: (f: TaskFilters) => void
}) {
  const counts = useMemo(() => {
    // For each dimension, apply every OTHER filter, then tally per option value.
    const base = (patch: Partial<TaskFilters>) => applyTaskFilters(tasks, { ...filters, ...patch }, statuses)
    const tally = (list: Task[], key: (t: Task) => string | undefined | null) => {
      const m = new Map<string, number>()
      for (const t of list) {
        const k = key(t)
        if (k) m.set(k, (m.get(k) ?? 0) + 1)
      }
      return m
    }
    const overdueBase = base({ overdue: 'all' })
    const overdueYes = overdueBase.filter((t) => t.is_overdue).length
    const userCounts = new Map<string, number>()
    for (const t of base({ user: 'all' })) {
      const seen = new Set<string>()
      for (const a of t.assignees ?? []) {
        if (!seen.has(a.user_id)) {
          seen.add(a.user_id)
          userCounts.set(a.user_id, (userCounts.get(a.user_id) ?? 0) + 1)
        }
      }
    }
    return {
      status: tally(base({ statusMode: 'all', statusIds: [] }), (t) => t.status_id),
      overdue: { overdue: overdueYes, not_overdue: overdueBase.length - overdueYes },
      priority: tally(base({ priority: 'all' }), (t) => t.priority_id),
      category: tally(base({ category: 'all' }), (t) => t.category_id),
      user: userCounts,
    }
  }, [tasks, filters, statuses])

  // People appearing on these tasks (assignees + CC), for the user dropdown.
  const userOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of tasks) {
      for (const a of t.assignees ?? []) {
        const name = a.user?.name ?? a.user_name
        if (name) m.set(a.user_id, name)
        else if (!m.has(a.user_id)) m.set(a.user_id, `${a.user_id.slice(0, 8)}…`)
      }
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [tasks])

  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-[#475569]">
        <Filter size={15} />
        <span className="font-medium">Filter</span>
      </div>
      <StatusMultiSelect statuses={statuses} filters={filters} counts={counts.status} onChange={onChange} />
      <StyledSelect
        value={filters.overdue}
        onChange={(v) => set({ overdue: v as OverdueFilter })}
        wrapperClassName="w-44"
        options={[
          { value: 'all', label: 'All deadlines' },
          { value: 'overdue', label: `Overdue (${counts.overdue.overdue})`, color: '#DC2626' },
          { value: 'not_overdue', label: `Not overdue (${counts.overdue.not_overdue})`, color: '#16A34A' },
        ]}
      />
      <StyledSelect
        value={filters.priority}
        onChange={(v) => set({ priority: v })}
        wrapperClassName="w-44"
        options={[
          { value: 'all', label: 'All Priorities' },
          ...priorities.map((p) => ({ value: p.id, label: `${p.label} (${counts.priority.get(p.id) ?? 0})`, color: p.color })),
        ]}
      />
      <StyledSelect
        value={filters.category}
        onChange={(v) => set({ category: v })}
        wrapperClassName="w-44"
        options={[
          { value: 'all', label: 'All Categories' },
          ...categories.map((c) => ({ value: c.id, label: `${c.name} (${counts.category.get(c.id) ?? 0})`, color: c.color })),
        ]}
      />
      <StyledSelect
        value={filters.user}
        onChange={(v) => set({ user: v })}
        wrapperClassName="w-44"
        options={[
          { value: 'all', label: 'All Users' },
          ...userOptions.map((u) => ({ value: u.id, label: `${u.name} (${counts.user.get(u.id) ?? 0})` })),
        ]}
      />
      {isTaskFiltered(filters) && (
        <button
          onClick={() => onChange({ ...EMPTY_TASK_FILTERS })}
          className="px-3 py-[7px] text-sm font-medium text-[#DC2626] border border-[#FECACA] bg-[#FEE2E2] rounded-[8px] hover:bg-[#FECACA] transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}
