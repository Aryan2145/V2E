import { shouldEntryFireToday, type RecurrenceEntry } from '../common/recurrence/should-fire-today';

// Builds a Google Calendar RRULE (+ holiday EXDATEs) from a v2e meeting-rhythm
// schedule, so ONE recurring Google event represents the whole series (Zoom-style).
// Assumes the Asia/Kolkata timezone (India has no DST), matching the spawner.

const TZ = 'Asia/Kolkata';
const DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const FREQ: Record<string, string> = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };

export interface RhythmScheduleShape {
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  every: number;
  days: number[];
  month_days: number[];
  yearly_dates: { month: number; day: number }[];
  time: string; // HH:MM (IST wall clock)
  start_date: Date;
  end_condition: 'never' | 'on_date' | 'after_n';
  end_date: Date | null;
  end_after: number | null;
  skip_holidays: boolean;
}

function pad(n: number): string { return String(n).padStart(2, '0'); }
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function ymd(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function toEntry(s: RhythmScheduleShape): RecurrenceEntry {
  return {
    start_date: startOfDay(s.start_date),
    schedule_type: s.schedule_type,
    every: s.every ?? 1,
    days: s.days ?? [],
    month_days: s.month_days ?? [],
    yearly_dates: s.yearly_dates ?? [],
    end_condition: s.end_condition ?? 'never',
    end_date: s.end_date ?? null,
    end_after: s.end_after ?? null,
    occurrence_count: 0,
  };
}

// The first day (>= start_date) the pattern fires — skipping holidays when the
// rhythm skips them, so the Google series anchor (DTSTART) is a real occurrence.
function firstOccurrence(s: RhythmScheduleShape, holidays: Set<string>): Date | null {
  const entry = toEntry(s);
  const d = startOfDay(s.start_date);
  for (let i = 0; i < 730; i++) {
    if (shouldEntryFireToday({ ...entry, occurrence_count: 0 }, d)) {
      if (!(s.skip_holidays && holidays.has(ymd(d)))) return new Date(d);
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

// The occurrence datetimes (wall clock, TZID) that fall on holidays → EXDATE lines,
// so the Google series skips holidays exactly like v2e does.
function holidayExdates(s: RhythmScheduleShape, first: Date, holidays: Set<string>, hh: number, mm: number): string[] {
  const entry = toEntry(s);
  const out: string[] = [];
  const d = new Date(first);
  // Bound the scan: to the end date, else ~1 year ahead.
  const end = s.end_condition === 'on_date' && s.end_date ? startOfDay(s.end_date) : (() => { const x = new Date(first); x.setFullYear(x.getFullYear() + 1); return x; })();
  while (d <= end && out.length < 200) {
    if (shouldEntryFireToday({ ...entry, occurrence_count: 0 }, d) && holidays.has(ymd(d))) {
      out.push(`${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hh)}${pad(mm)}00`);
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// UNTIL must be UTC when DTSTART is zoned (RFC5545). Convert an IST wall-clock
// end-of-day to a UTC basic stamp using the fixed +05:30 offset.
function untilUtc(endDate: Date): string {
  const iso = `${ymd(endDate)}T23:59:00+05:30`;
  const u = new Date(iso);
  return `${u.getUTCFullYear()}${pad(u.getUTCMonth() + 1)}${pad(u.getUTCDate())}T${pad(u.getUTCHours())}${pad(u.getUTCMinutes())}${pad(u.getUTCSeconds())}Z`;
}

export interface BuiltRecurrence {
  startWall: string;   // "YYYY-MM-DDTHH:MM:00" (interpret in Asia/Kolkata)
  timeZone: string;    // 'Asia/Kolkata'
  recurrence: string[];// ['RRULE:...', 'EXDATE;TZID=...:...']
}

// Returns null when no occurrence exists (e.g. an already-past bounded series).
export function buildRecurrence(s: RhythmScheduleShape, holidayDates: string[]): BuiltRecurrence | null {
  const holidays = new Set(s.skip_holidays ? holidayDates : []);
  const first = firstOccurrence(s, holidays);
  if (!first) return null;

  const [hh, mm] = String(s.time || '09:00').split(':').map(Number);
  const startWall = `${ymd(first)}T${pad(hh || 0)}:${pad(mm || 0)}:00`;

  const every = Math.max(1, s.every || 1);
  const parts: string[] = [`FREQ=${FREQ[s.schedule_type]}`];
  if ((s.schedule_type === 'daily' || s.schedule_type === 'weekly' || s.schedule_type === 'monthly') && every > 1) {
    parts.push(`INTERVAL=${every}`);
  }
  if (s.schedule_type === 'weekly' && (s.days ?? []).length) {
    parts.push(`BYDAY=${s.days.slice().sort((a, b) => a - b).map((d) => DOW[d]).join(',')}`);
  }
  if (s.schedule_type === 'monthly' && (s.month_days ?? []).length) {
    parts.push(`BYMONTHDAY=${s.month_days.join(',')}`);
  }
  if (s.schedule_type === 'yearly' && (s.yearly_dates ?? []).length) {
    const y = s.yearly_dates[0];
    parts.push(`BYMONTH=${y.month}`, `BYMONTHDAY=${y.day}`);
  }
  if (s.end_condition === 'after_n' && s.end_after) parts.push(`COUNT=${s.end_after}`);
  else if (s.end_condition === 'on_date' && s.end_date) parts.push(`UNTIL=${untilUtc(s.end_date)}`);

  const recurrence = [`RRULE:${parts.join(';')}`];
  const exdates = holidayExdates(s, first, holidays, hh || 0, mm || 0);
  if (exdates.length) recurrence.push(`EXDATE;TZID=${TZ}:${exdates.join(',')}`);

  return { startWall, timeZone: TZ, recurrence };
}
