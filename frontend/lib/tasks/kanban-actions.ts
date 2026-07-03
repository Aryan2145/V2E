import { tasksApi } from '@/lib/api/tasks'
import { TERMINAL_STATUS_PHASES, type Task, type TaskStatus } from '@/lib/types/tasks'

// The Kanban board's meaning follows the viewer's role: on "My Tasks" a drag acts on
// YOUR part (all_must_complete) or the shared status (any_can); on "Assigned by me" it
// acts on the WHOLE task (owner power). See project_task_completion_model memory.
export type KanbanPerspective = 'assignee' | 'owner'

export function isTerminalType(type?: string | null): boolean {
  return !!type && TERMINAL_STATUS_PHASES.includes(type as never)
}

/** Is a closed task still inside its frictionless undo window? */
export function withinUndoWindow(task: Task): boolean {
  return !!task.reopen_expires_at && new Date(task.reopen_expires_at).getTime() > Date.now()
}

/**
 * Which status column a card belongs in.
 *  - Closed task → its overall outcome column (Completed / Partial / Incomplete).
 *  - Open, owner view or any_can → the overall/shared status.
 *  - Open all_must on My Tasks → the viewer's OWN personal progress (their part).
 */
export function kanbanColumnId(
  task: Task,
  perspective: KanbanPerspective,
  currentUserId: string | undefined,
  statuses: TaskStatus[],
): string {
  const byType = (t: string) => statuses.find((s) => s.type === t)?.id
  // Owner board or any_can → the overall/shared status (Partially Completed is a real
  // outcome there).
  if (perspective === 'owner' || task.completion_mode !== 'all_must_complete') return task.status_id
  // My Tasks (all_must) → MY personal progress, even for closed tasks. A single person is
  // never "partially completed", so that column never applies here (it's hidden on this
  // board) — a task that closed as Partial lands in my own outcome column instead.
  const me = task.assignees?.find((a) => a.user_id === currentUserId && !a.is_cc)
  if (me) {
    if (me.is_completed) return byType('completed') ?? task.status_id
    if (me.cannot_complete) return byType('incomplete') ?? task.status_id
    return me.status_id ?? byType('not_started') ?? task.status_id
  }
  // Not a worker (e.g. CC): fold a whole-task Partial into a visible closed column.
  if (task.status?.type === 'partially_completed') return byType('incomplete') ?? task.status_id
  return task.status_id
}

export type DropOutcome =
  | { kind: 'done'; task: Task }
  | { kind: 'needsReason'; mode: 'flag' | 'incomplete' }
  | { kind: 'blocked'; message: string }
  | { kind: 'noop' }

/**
 * Resolve a Kanban drop into the correct mode/role-aware action, calling the existing
 * dedicated endpoints (never a raw status write). Returns `needsReason` when the target
 * requires a remark (the caller collects it and calls again with `reason`).
 */
export async function resolveKanbanDrop(
  task: Task,
  target: TaskStatus,
  ctx: { orgId: string; perspective: KanbanPerspective },
  reason?: string,
): Promise<DropOutcome> {
  const { orgId, perspective } = ctx
  const targetTerminal = isTerminalType(target.type)
  const sourceTerminal = isTerminalType(task.status?.type)
  const allMust = task.completion_mode === 'all_must_complete'
  const reasonMode: 'flag' | 'incomplete' = perspective === 'assignee' && allMust ? 'flag' : 'incomplete'

  // "Partially Completed" is a system-derived outcome — never a manual drop target.
  if (target.type === 'partially_completed') {
    return {
      kind: 'blocked',
      message: 'Partially Completed is set automatically when some finish and some can’t — mark your own part instead.',
    }
  }

  // Closing as Incomplete always needs a reason — collect it before touching anything.
  if (target.type === 'incomplete' && !reason) {
    return { kind: 'needsReason', mode: reasonMode }
  }

  // Source is closed: within the window this is an UNDO (then optionally re-close);
  // after the window it's locked.
  if (sourceTerminal) {
    if (!withinUndoWindow(task)) {
      return { kind: 'blocked', message: 'This task is locked. Reopen it from the task page to change the outcome.' }
    }
    const reopened = await tasksApi.reopenTask(orgId, task.id) // frictionless undo
    if (!targetTerminal) {
      if (!allMust) return { kind: 'done', task: await tasksApi.setSharedStatus(orgId, task.id, target.id) }
      if (perspective === 'assignee') return { kind: 'done', task: await tasksApi.setAssigneeStatus(orgId, task.id, target.id) }
      return { kind: 'done', task: reopened } // owner all_must → just reopened (per-person set on the task page)
    }
    // target terminal → re-close the now-open task below
  }

  // Target: an open stage.
  if (!targetTerminal) {
    if (perspective === 'owner' || !allMust) {
      if (allMust) {
        return { kind: 'blocked', message: 'Set each person’s status on the task — from here the whole task can only be closed.' }
      }
      return { kind: 'done', task: await tasksApi.setSharedStatus(orgId, task.id, target.id) }
    }
    return { kind: 'done', task: await tasksApi.setAssigneeStatus(orgId, task.id, target.id) }
  }

  // Target: Completed.
  if (target.type === 'completed') {
    if (perspective === 'owner' && allMust) {
      return { kind: 'done', task: await tasksApi.completeTask(orgId, task.id, true) } // whole task
    }
    return { kind: 'done', task: await tasksApi.completeTask(orgId, task.id) } // my part / whole (any_can)
  }

  // Target: Incomplete (reason present).
  if (target.type === 'incomplete') {
    if (perspective === 'assignee' && allMust) {
      return { kind: 'done', task: await tasksApi.flagCannotComplete(orgId, task.id, reason!) }
    }
    return { kind: 'done', task: await tasksApi.markIncomplete(orgId, task.id, reason!) }
  }

  return { kind: 'noop' }
}
