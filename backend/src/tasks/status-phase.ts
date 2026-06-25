/**
 * Task status phase model.
 *
 * Every task status maps to exactly one fixed *phase* (its `type`). The phase is
 * the machine meaning the rest of the system keys off — the label/colour are
 * cosmetic and org-configurable. There are exactly four phases:
 *
 *   - not_started : where every new task is born. Exactly one per org; it is the default.
 *   - in_progress : active work. The only phase that may have multiple statuses (stages).
 *   - completed   : terminal. Closes the task AND counts as a successful completion.
 *   - incomplete  : terminal. Closes the task but is tracked separately (not a success).
 *
 * Two predicates capture the meanings that used to be a scattered `type === 'completed'`:
 *
 *   - isTerminal  : the task is closed (completed OR incomplete) — used to stop overdue
 *                   sweeps, escalation, workload counts, leave-conflict scans, etc.
 *   - isSuccessful: the task finished successfully (completed only) — used for
 *                   performance/analytics (completion %, project progress, recurring stats).
 */

export const STATUS_PHASES = ['not_started', 'in_progress', 'completed', 'incomplete'] as const;
export type StatusPhase = (typeof STATUS_PHASES)[number];

/** Phases that may only ever have ONE active status per organization. */
export const SINGLETON_PHASES: StatusPhase[] = ['not_started', 'completed', 'incomplete'];

/** Phases that close a task (it is finished, success or not). */
export const TERMINAL_TYPES: StatusPhase[] = ['completed', 'incomplete'];

export function isTerminal(type: string | null | undefined): boolean {
  return type === 'completed' || type === 'incomplete';
}

export function isSuccessful(type: string | null | undefined): boolean {
  return type === 'completed';
}

export function isSingletonPhase(type: string | null | undefined): boolean {
  return type === 'not_started' || type === 'completed' || type === 'incomplete';
}
