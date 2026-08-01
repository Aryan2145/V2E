'use client'

import type { Task, TaskStatus } from '@/lib/types/tasks'
import { TERMINAL_STATUS_PHASES } from '@/lib/types/tasks'

// Every section is a multi-select where an EMPTY array means "all" (no narrowing).
// Status keeps a preset mode so its default can be "Open" rather than "everything".
//  - statusMode 'open'  (default) → every non-terminal status
//  - statusMode 'all'            → every status, open AND closed
//  - statusMode 'custom'         → the explicit `statusIds` set
export type StatusMode = 'open' | 'all' | 'custom'
export type DeadlineKey = 'overdue' | 'upcoming'

export interface TaskFilters {
  statusMode: StatusMode
  /** Only meaningful when statusMode === 'custom'. */
  statusIds: string[]
  /** Selected deadline buckets — empty = all (both overdue and upcoming). */
  deadlines: DeadlineKey[]
  /** Selected priority ids — empty = all. */
  priorityIds: string[]
  /** Selected category ids — empty = all. */
  categoryIds: string[]
  /** Selected assignee ids — empty = all (Anyone). */
  userIds: string[]
}

// Default view: Open tasks, everything else unfiltered.
export const EMPTY_TASK_FILTERS: TaskFilters = {
  statusMode: 'open',
  statusIds: [],
  deadlines: [],
  priorityIds: [],
  categoryIds: [],
  userIds: [],
}

export function isTaskFiltered(f: TaskFilters): boolean {
  return (
    f.statusMode !== 'open' ||
    f.deadlines.length > 0 ||
    f.priorityIds.length > 0 ||
    f.categoryIds.length > 0 ||
    f.userIds.length > 0
  )
}

// How many filter dimensions are active — drives the count badge on the Filters button.
export function countActiveFilters(f: TaskFilters): number {
  return (
    (f.statusMode !== 'open' ? 1 : 0) +
    (f.deadlines.length > 0 ? 1 : 0) +
    (f.priorityIds.length > 0 ? 1 : 0) +
    (f.categoryIds.length > 0 ? 1 : 0) +
    (f.userIds.length > 0 ? 1 : 0)
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

function matchesDeadline(t: Task, keys: DeadlineKey[]): boolean {
  if (keys.length === 0) return true
  return keys.some((k) => (k === 'overdue' ? !!t.is_overdue : !t.is_overdue))
}

export function applyTaskFilters(tasks: Task[], f: TaskFilters, statuses: TaskStatus[]): Task[] {
  return tasks.filter((t) =>
    matchesStatus(t, f, statuses) &&
    matchesDeadline(t, f.deadlines) &&
    (f.priorityIds.length === 0 || (!!t.priority_id && f.priorityIds.includes(t.priority_id))) &&
    (f.categoryIds.length === 0 || (!!t.category_id && f.categoryIds.includes(t.category_id))) &&
    (f.userIds.length === 0 || (t.assignees ?? []).some((a) => f.userIds.includes(a.user_id))),
  )
}
