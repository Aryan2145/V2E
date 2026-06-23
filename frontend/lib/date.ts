/**
 * Date helpers for `@db.Date` values.
 *
 * Prisma `DateTime @db.Date` columns (holiday dates, etc.) come back from the API
 * as FULL ISO timestamps — e.g. "2026-01-26T00:00:00.000Z" — not bare "2026-01-26".
 * The old code did `new Date(value + 'T00:00:00')`, which on a full-ISO string yields
 * "...ZT00:00:00" → `Invalid Date`. These helpers normalize to the bare calendar date
 * and parse at *local* midnight so the day never drifts across timezones.
 */

/** Bare YYYY-MM-DD, accepting either a date-only or full-ISO string. */
export function dateOnly(value: string): string {
  return value.slice(0, 10)
}

/** Parse a date-only or full-ISO string as local midnight (no timezone drift). */
export function parseLocalDate(value: string): Date {
  return new Date(dateOnly(value) + 'T00:00:00')
}
