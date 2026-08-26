// Calculates calendar, payment, and analytics date periods using date-only values.

import { dateKeyDayOfWeek, formatDayHeading, zonedDateTimeToIso } from '@/lib/date';
import type { AnalyticsPeriod } from '@/lib/admin-types';

export function dateKeyParts(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
}

export function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDays(dateKey: string, amount: number) {
  const { year, month, day } = dateKeyParts(dateKey);
  // Noon UTC keeps date-only calculations away from midnight and daylight-saving boundaries.
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return dateKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addOneMonth(dateKey: string) {
  const { year, month, day } = dateKeyParts(dateKey);
  const nextMonth = new Date(Date.UTC(year, month, 1, 12));
  const nextYear = nextMonth.getUTCFullYear();
  const nextMonthNumber = nextMonth.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonthNumber, 0, 12)).getUTCDate();
  return dateKeyFromParts(nextYear, nextMonthNumber, Math.min(day, lastDay));
}

export function shiftMonth(dateKey: string, amount: number) {
  const { year, month, day } = dateKeyParts(dateKey);
  const target = new Date(Date.UTC(year, month - 1 + amount, 1, 12));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0, 12)).getUTCDate();
  return dateKeyFromParts(targetYear, targetMonth, Math.min(day, lastDay));
}

export function startOfSundayWeek(dateKey: string) {
  return addDays(dateKey, -dateKeyDayOfWeek(dateKey));
}

export function daysBetween(startDateKey: string, endDateKey: string) {
  const start = dateKeyParts(startDateKey);
  const end = dateKeyParts(endDateKey);
  const milliseconds = Date.UTC(end.year, end.month - 1, end.day, 12)
    - Date.UTC(start.year, start.month - 1, start.day, 12);
  return Math.round(milliseconds / 86_400_000);
}

export function monthBounds(dateKey: string, timeZone: string) {
  const { year, month } = dateKeyParts(dateKey);
  const nextMonth = new Date(Date.UTC(year, month, 1, 12));
  return {
    start: zonedDateTimeToIso(dateKeyFromParts(year, month, 1), '00:00', timeZone),
    end: zonedDateTimeToIso(
      dateKeyFromParts(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 1),
      '00:00',
      timeZone,
    ),
  };
}

export function periodStart(dateKey: string, period: AnalyticsPeriod) {
  if (period === 'day') return dateKey;
  if (period === 'week') {
    const daysSinceMonday = (dateKeyDayOfWeek(dateKey) + 6) % 7;
    return addDays(dateKey, -daysSinceMonday);
  }
  const { year, month } = dateKeyParts(dateKey);
  return dateKeyFromParts(year, month, 1);
}

export function shiftPeriod(dateKey: string, period: AnalyticsPeriod, amount: number) {
  if (period === 'day') return addDays(dateKey, amount);
  if (period === 'week') return addDays(dateKey, amount * 7);
  return shiftMonth(dateKey, amount);
}

export function periodBounds(dateKey: string, period: AnalyticsPeriod, timeZone: string) {
  const startDateKey = periodStart(dateKey, period);
  const endDateKey = period === 'day'
    ? addDays(startDateKey, 1)
    : period === 'week'
      ? addDays(startDateKey, 7)
      : periodStart(shiftMonth(startDateKey, 1), 'month');
  return {
    start: zonedDateTimeToIso(startDateKey, '00:00', timeZone),
    end: zonedDateTimeToIso(endDateKey, '00:00', timeZone),
    startDateKey,
    endDateKey,
  };
}

export function periodLabel(dateKey: string, period: AnalyticsPeriod) {
  if (period === 'day') return formatDayHeading(dateKey).long;
  if (period === 'month') return monthLabel(dateKey);

  const start = periodStart(dateKey, period);
  const end = addDays(start, 6);
  const startParts = dateKeyParts(start);
  const endParts = dateKeyParts(end);
  const startDate = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day, 12));
  const endDate = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day, 12));
  const startLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(startDate);
  const endLabel = new Intl.DateTimeFormat('en', {
    month: startParts.month === endParts.month ? undefined : 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(endDate);
  return `${startLabel}–${endLabel}`;
}

export function monthLabel(dateKey: string) {
  const { year, month } = dateKeyParts(dateKey);
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

export function monthDayLabel(dateKey: string) {
  const { year, month, day } = dateKeyParts(dateKey);
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}
