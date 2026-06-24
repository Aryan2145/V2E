import type { LeaveAvailability } from '@/lib/types/leave'

/** Local ISO yyyy-mm-dd for `d` (no UTC shift). */
function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today as ISO yyyy-mm-dd (local). */
export function todayIso(): string {
  return toIso(new Date())
}

/** A bounded horizon (default +180 days) so availability queries stay cheap. */
export function leaveHorizon(days = 180): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toIso(d)
}

/**
 * Expand the effective leave windows in an availability response into a flat set of
 * ISO day strings, clipped to [from, to]. Used to dot the deadline date picker.
 */
export function expandLeaveDays(avail: LeaveAvailability | null, from: string, to: string): string[] {
  if (!avail) return []
  const out = new Set<string>()
  for (const r of avail.results) {
    for (const w of r.windows) {
      const start = w.start_date > from ? w.start_date : from
      const end = w.end_date < to ? w.end_date : to
      if (start > end) continue
      // Iterate day-by-day. Bounded by the horizon passed in.
      const cur = new Date(`${start}T00:00:00`)
      const last = new Date(`${end}T00:00:00`)
      let guard = 0
      while (cur <= last && guard < 800) {
        out.add(toIso(cur))
        cur.setDate(cur.getDate() + 1)
        guard++
      }
    }
  }
  return Array.from(out)
}
