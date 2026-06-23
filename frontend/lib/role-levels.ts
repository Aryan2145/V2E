import type { RoleLevel } from './types'

/** Pill background + text colors per role level (shared across role UIs). */
export const levelColors: Record<RoleLevel, string> = {
  junior: 'bg-[#DCFCE7] text-[#16A34A]',
  mid: 'bg-[#DBEAFE] text-[#1D4ED8]',
  senior: 'bg-[#FEF9C3] text-[#CA8A04]',
  lead: 'bg-[#FEE2E2] text-[#DC2626]',
  head: 'bg-[#F3E8FF] text-[#7C3AED]',
}

/** Seniority order, most senior first — for sorting role lists. */
export const LEVEL_RANK: Record<RoleLevel, number> = {
  head: 0,
  lead: 1,
  senior: 2,
  mid: 3,
  junior: 4,
}

export const rankOfLevel = (lvl?: RoleLevel) => (lvl ? LEVEL_RANK[lvl] : 5)
