// Shared recurrence helper — decides whether a recurrence schedule entry fires on a
// given day. Used by the recurring-task spawn engine and the Work Log demanded-log
// spawner so the date math lives in exactly one place.
//
// Uses day-from-start-date modulo arithmetic (not RRULE). All end conditions are
// checked before the schedule itself.

export interface RecurrenceEntry {
  start_date: Date;
  schedule_type: string; // 'daily' | 'weekly' | 'monthly' | 'yearly'
  every: number;
  days: unknown; // number[]   (weekly: 0-6)
  month_days: unknown; // number[]   (monthly: 1-31)
  yearly_dates: unknown; // { month: number; day: number }[]
  end_condition: string; // 'never' | 'on_date' | 'after_n'
  end_date: Date | null;
  end_after: number | null;
  occurrence_count: number;
}

export function shouldEntryFireToday(entry: RecurrenceEntry, now: Date = new Date()): boolean {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(entry.start_date);
  startDate.setHours(0, 0, 0, 0);

  if (today < startDate) return false;

  if (entry.end_condition === 'on_date' && entry.end_date) {
    const endDate = new Date(entry.end_date);
    endDate.setHours(0, 0, 0, 0);
    if (today > endDate) return false;
  }
  if (entry.end_condition === 'after_n' && entry.end_after !== null) {
    if (entry.occurrence_count >= entry.end_after) return false;
  }

  const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / 86_400_000);
  const todayDow = today.getDay();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth() + 1;

  switch (entry.schedule_type) {
    case 'daily':
      return daysDiff % entry.every === 0;

    case 'weekly': {
      const weeksDiff = Math.floor(daysDiff / 7);
      if (weeksDiff % entry.every !== 0) return false;
      const days = entry.days as number[];
      return Array.isArray(days) && days.includes(todayDow);
    }

    case 'monthly': {
      const monthDays = entry.month_days as number[];
      if (!Array.isArray(monthDays)) return false;

      // Check if today is the last day of the month
      const nextDay = new Date(today);
      nextDay.setDate(today.getDate() + 1);
      const isLastDay = nextDay.getMonth() !== today.getMonth();

      // A selected day matches today if it is exactly today's date,
      // or if today is the last day of the month and the selected day is greater than today's date.
      const hasMatch = monthDays.some((d) => {
        if (d < 0) {
          const targetDay = Math.abs(d);
          return todayDate === targetDay || (isLastDay && targetDay > todayDate);
        } else {
          return todayDate === d;
        }
      });
      if (!hasMatch) return false;

      const monthsDiff =
        (today.getFullYear() - startDate.getFullYear()) * 12 +
        (today.getMonth() - startDate.getMonth());
      return monthsDiff % entry.every === 0;
    }

    case 'yearly': {
      const yearlyDates = entry.yearly_dates as { month: number; day: number }[];
      if (!Array.isArray(yearlyDates)) return false;
      const matches = yearlyDates.some((d) => d.month === todayMonth && d.day === todayDate);
      if (!matches) return false;
      const yearsDiff = today.getFullYear() - startDate.getFullYear();
      return yearsDiff % entry.every === 0;
    }

    default:
      return false;
  }
}
