'use client'

import React, { useMemo } from 'react'
import { Filter } from 'lucide-react'
import StyledSelect from '@/components/ui/StyledSelect'
import type { Task, TaskCategory, TaskPriority, TaskStatus } from '@/lib/types/tasks'

export interface TaskFilters {
  status: string
  priority: string
  category: string
  user: string
}

export const EMPTY_TASK_FILTERS: TaskFilters = { status: 'all', priority: 'all', category: 'all', user: 'all' }

export function isTaskFiltered(f: TaskFilters): boolean {
  return f.status !== 'all' || f.priority !== 'all' || f.category !== 'all' || f.user !== 'all'
}

export function applyTaskFilters(tasks: Task[], f: TaskFilters): Task[] {
  return tasks.filter((t) =>
    (f.status === 'all' || t.status_id === f.status) &&
    (f.priority === 'all' || t.priority_id === f.priority) &&
    (f.category === 'all' || t.category_id === f.category) &&
    (f.user === 'all' || (t.assignees ?? []).some((a) => a.user_id === f.user)),
  )
}

/**
 * Shared task filter toolbar: status / priority / category / user, with live
 * line-item counts on every option (counts respect the other active filters,
 * so the number always matches what selecting the option would show).
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
    const base = (skip: keyof TaskFilters) => applyTaskFilters(tasks, { ...filters, [skip]: 'all' })
    const tally = (list: Task[], key: (t: Task) => string | undefined | null) => {
      const m = new Map<string, number>()
      for (const t of list) {
        const k = key(t)
        if (k) m.set(k, (m.get(k) ?? 0) + 1)
      }
      return m
    }
    const userCounts = new Map<string, number>()
    for (const t of base('user')) {
      const seen = new Set<string>()
      for (const a of t.assignees ?? []) {
        if (!seen.has(a.user_id)) {
          seen.add(a.user_id)
          userCounts.set(a.user_id, (userCounts.get(a.user_id) ?? 0) + 1)
        }
      }
    }
    return {
      status: tally(base('status'), (t) => t.status_id),
      priority: tally(base('priority'), (t) => t.priority_id),
      category: tally(base('category'), (t) => t.category_id),
      user: userCounts,
    }
  }, [tasks, filters])

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
      <StyledSelect
        value={filters.status}
        onChange={(v) => set({ status: v })}
        wrapperClassName="w-44"
        options={[
          { value: 'all', label: 'All Statuses' },
          ...statuses.map((s) => ({ value: s.id, label: `${s.label} (${counts.status.get(s.id) ?? 0})`, color: s.color })),
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
