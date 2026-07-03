/**
 * Task status phase model.
 *
 * Every task status maps to exactly one fixed *phase* (its `type`). The phase is
 * the machine meaning the rest of the system keys off — the label/colour are
 * cosmetic and org-configurable. There are exactly four phases:
 *
 *   - not_started         : where every new task is born. Exactly one per org; it is the default.
 *   - in_progress         : active work. The only phase that may have multiple statuses (stages).
 *   - completed           : terminal. Closes the task AND counts as a successful completion.
 *   - partially_completed : terminal. Closes an "all must complete" task where every worker
 *                           responded but only SOME finished (the rest flagged can't-complete).
 *   - incomplete          : terminal. Closes the task, nobody's part succeeded (not a success).
 *
 * Predicates capture the meanings that used to be a scattered `type === 'completed'`:
 *
 *   - isTerminal  : the task is closed (completed, partially_completed, OR incomplete) — used to
 *                   stop overdue sweeps, escalation, workload counts, leave-conflict scans, etc.
 *   - isSuccessful: the task finished FULLY successfully (completed only) — used for
 *                   performance/analytics (completion %, project progress, recurring stats).
 *                   Partial does NOT count as a full success.
 */

export const STATUS_PHASES = ['not_started', 'in_progress', 'completed', 'partially_completed', 'incomplete'] as const;
export type StatusPhase = (typeof STATUS_PHASES)[number];

/** Phases that may only ever have ONE active status per organization. */
export const SINGLETON_PHASES: StatusPhase[] = ['not_started', 'completed', 'partially_completed', 'incomplete'];

/** Phases that close a task (it is finished, success or not). */
export const TERMINAL_TYPES: StatusPhase[] = ['completed', 'partially_completed', 'incomplete'];

export function isTerminal(type: string | null | undefined): boolean {
  return type === 'completed' || type === 'partially_completed' || type === 'incomplete';
}

export function isSuccessful(type: string | null | undefined): boolean {
  return type === 'completed';
}

/** Closed with a mix of finished + couldn't-finish parts (all_must_complete). */
export function isPartial(type: string | null | undefined): boolean {
  return type === 'partially_completed';
}

export function isSingletonPhase(type: string | null | undefined): boolean {
  return type === 'not_started' || type === 'completed' || type === 'partially_completed' || type === 'incomplete';
}
