import type { RecurringTemplate, RecurringScheduleEntry } from '@/lib/types/tasks'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Plain-English label for a single schedule entry (e.g. "Every Mon", "Day 1 monthly"). */
export function entryLabel(entry: RecurringScheduleEntry): string {
  const e = entry
  switch (e.schedule_type) {
    case 'daily':
      return `Every ${e.every > 1 ? `${e.every} days` : 'day'}`
    case 'weekly': {
      const days = Array.isArray(e.days) ? (e.days as number[]).map((d) => DOW[d]).join(', ') : ''
      return `Every ${e.every > 1 ? `${e.every} weeks` : 'week'}${days ? ` on ${days}` : ''}`
    }
    case 'monthly': {
      const md = Array.isArray(e.month_days) ? (e.month_days as number[]) : []
      const dayStr = md.length === 0 ? '?' : md.length <= 3 ? md.join(', ') : `${md.slice(0, 3).join(', ')}…`
      return `Day${md.length !== 1 ? 's' : ''} ${dayStr} every ${e.every > 1 ? `${e.every} months` : 'month'}`
    }
    case 'yearly': {
      const dates = Array.isArray(e.yearly_dates) ? (e.yearly_dates as { month: number; day: number }[]) : []
      if (dates.length === 0) return 'Yearly'
      if (dates.length === 1) return `${MONTHS_SHORT[dates[0].month - 1]} ${dates[0].day} each year`
      return `${dates.length} dates each year`
    }
    default:
      return e.schedule_type
  }
}

/** Cadence summary across a template's schedule entries. */
export function scheduleLabel(t: RecurringTemplate): string {
  const entries = t.schedule_entries ?? []
  if (entries.length === 0) return 'No schedule'
  if (entries.length === 1) return entryLabel(entries[0])
  return `${entries.length} schedules`
}

export function formatDate(str: string): string {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
