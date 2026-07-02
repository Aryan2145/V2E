import { ReminderRecurrence, ReminderType } from '@prisma/client';

/** Who a reminder notifies. Mirrors the ReminderType enum values. */
export type RecipientType = 'assignee' | 'assigner' | 'cc';

/**
 * A creator-set reminder, as carried in the create DTOs and stored on a recurring
 * template (`RecurringTemplate.reminder_specs`).
 *
 * - `relative`: fires `offset_days` before the deadline, at `time` (HH:mm, default
 *   09:00). For one-time tasks the frontend precomputes `remind_at`; for recurring
 *   templates `remind_at` is omitted so it can be recomputed per spawned instance.
 * - `absolute`: fires at `remind_at` (a precomputed instant). `yearly` re-arms it
 *   each year (until the task closes).
 */
export interface ReminderSpec {
  kind: 'relative' | 'absolute';
  offset_days?: number;
  time?: string; // 'HH:mm'
  remind_at?: string; // ISO instant
  yearly?: boolean;
  recipients: RecipientType[];
}

/** Advance a date by whole years until it is strictly after `now`. */
function rollForwardYears(base: Date, now: Date): Date {
  const d = new Date(base);
  while (d <= now) d.setFullYear(d.getFullYear() + 1);
  return d;
}

/**
 * Resolve a spec to the absolute instant it should fire, given the task's deadline
 * (needed for relative reminders) and the current clock. Returns null when the
 * reminder cannot/should not be created (e.g. a relative reminder with no deadline,
 * or a past one-time reminder).
 */
export function resolveRemindAt(spec: ReminderSpec, deadline: Date | null, now: Date): Date | null {
  // A precomputed instant (absolute reminders, and one-time relative ones the
  // frontend already resolved in the user's local timezone).
  if (spec.remind_at) {
    const base = new Date(spec.remind_at);
    if (isNaN(base.getTime())) return null;
    if (spec.yearly) return rollForwardYears(base, now);
    return base > now ? base : null;
  }

  // Relative reminder recomputed from a deadline (recurring spawn path).
  if (spec.kind === 'relative') {
    if (!deadline) return null;
    const base = new Date(deadline);
    base.setDate(base.getDate() - (spec.offset_days ?? 0));
    const [h, m] = (spec.time ?? '09:00').split(':').map(Number);
    base.setHours(h || 0, m || 0, 0, 0);
    if (spec.yearly) return rollForwardYears(base, now);
    return base > now ? base : null;
  }

  return null;
}

/**
 * Expand a resolved reminder into one TaskReminder row per selected recipient type.
 * The assignee is always included even if a spec omits it.
 */
export function expandReminderRows(
  spec: ReminderSpec,
  remindAt: Date,
): Array<{ remind_at: Date; type: ReminderType; offset_days: number | null; recurrence: ReminderRecurrence }> {
  const recipients = new Set<RecipientType>(spec.recipients?.length ? spec.recipients : ['assignee']);
  recipients.add('assignee');
  const offset_days = spec.kind === 'relative' ? spec.offset_days ?? 0 : null;
  const recurrence: ReminderRecurrence = spec.yearly ? 'yearly' : 'one_time';
  return Array.from(recipients).map((type) => ({
    remind_at: remindAt,
    type: type as ReminderType,
    offset_days,
    recurrence,
  }));
}
