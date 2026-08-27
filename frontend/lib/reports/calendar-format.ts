import type { DayResult } from '@/lib/types/reports'

// Shared marks, colours and labels for the Monthly Task Compliance Calendar.
// Colour == meaning: green done-on-time, amber late, red missed, white due-not-yet.

export interface ResultMeta {
  code: string       // single letter shown in a cell
  label: string      // full phrase (legend + tooltip)
  fg: string         // text colour
  bg: string         // cell fill
  border: string     // cell border
}

export const RESULT_META: Record<DayResult, ResultMeta> = {
  on_time: { code: 'D', label: 'Done on time', fg: '#166534', bg: '#DCFCE7', border: '#86EFAC' },
  late: { code: 'L', label: 'Done late', fg: '#92400E', bg: '#FEF3C7', border: '#FCD34D' },
  missed: { code: 'X', label: 'Missed — still not done', fg: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5' },
  future: { code: 'W', label: 'Due, date not yet arrived', fg: '#475569', bg: '#FFFFFF', border: '#CBD5E1' },
}

export const RESULT_ORDER: DayResult[] = ['on_time', 'late', 'missed', 'future']

export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** "10 June 2026" — for the As-on chip. */
export function fmtAsOn(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Shift a 'YYYY-MM' string by ±n months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
