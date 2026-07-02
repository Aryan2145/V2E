// Central notification catalog. Every notification belongs to a module so a
// whole module's notifications can be switched off in one place later (when
// per-customer module access control is built).

export const NOTIF_EVENTS = {
  tasks: [
    'task_assigned',
    'task_unassigned', // removed from a task's assignees/CC
    'task_completed',
    'task_reopened',
    'task_comment',
    'task_reminder',
    'task_overdue',
    'task_overdue_followup',
    'task_escalated',
    'recurring_spawned',
    'assignee_on_leave_conflict', // new leave overlaps an existing task's deadline
    'recurring_assignee_on_leave', // upcoming recurring occurrence lands on an assignee's leave
  ],
  projects: ['project_created', 'project_member_added', 'milestone_completed'],
  workflows: [
    'workflow_triggered',
    'workflow_step_assigned',
    'workflow_step_overdue',
    'workflow_upstream_delay',
    'workflow_completed',
  ],
  tickets: ['ticket_raised', 'ticket_status_changed', 'ticket_sla_breached', 'ticket_comment', 'ticket_escalated'],
  meetings: [
    'meeting_invited',
    'meeting_poll_opened',
    'meeting_response',
    'meeting_reschedule_requested',
    'meeting_slot_confirmed',
    'meeting_updated',
    'meeting_reminder',
    'meeting_cancelled',
  ],
  work_logs: [
    'work_log_demanded',
    'work_log_demand_due',
    'work_log_remark',
    'work_log_remark_reply',
    'work_log_submitted',
  ],
  communication: [],
  system: [],
  leave: ['leave_requested', 'leave_decided', 'leave_overridden'],
} as const;

export type NotifModule = keyof typeof NOTIF_EVENTS;

export const ALL_NOTIF_EVENTS: { module: NotifModule; event: string }[] = (
  Object.keys(NOTIF_EVENTS) as NotifModule[]
).flatMap((m) => NOTIF_EVENTS[m].map((event) => ({ module: m, event })));
