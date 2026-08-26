import type { Locale } from "@/lib/i18n";
import { intlLocale } from "@/lib/i18n";

export type CourtSlot = { id: string; start: number; end: number };
export type TimeSelection = { date: Date; startMinutes: number; endMinutes: number };
export type DragState = TimeSelection & { pointerId: number; anchorMinutes: number };
export type ConfirmationState = "idle" | "saving" | "success" | "error";
export type AvailabilityState = "loading" | "ready" | "error";
export type AvailabilityRow = { start_at: string; end_at: string };
export type CalendarBlockRow = AvailabilityRow & { block_type: "reserved" | "maintenance" };
export type WaitlistOpportunity = AvailabilityRow & {
  reservation_id: string;
  reservation_type: "private" | "open";
  waitlist_status: string | null;
  waitlist_position: number | null;
};
export type FriendRow = {
  player_id: string;
  username: string;
  status: "pending" | "accepted" | "rejected";
  direction: string;
};
export type ScheduleRuleRow = {
  opening_time: string | null;
  closing_time: string | null;
  slot_duration_minutes: number;
  is_open: boolean;
};

export const hourHeight = 64;
export const minimumReservationMinutes = 60;
export const facilityTimeZone = "Asia/Beirut";
export const defaultSchedule: ScheduleRuleRow = {
  opening_time: "16:00:00",
  closing_time: "22:00:00",
  slot_duration_minutes: 30,
  is_open: true,
};

export function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function addMonth(date: Date) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

export function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function databaseDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function timeStringToMinutes(value: string | null, fallback: number) {
  if (!value) return fallback;
  const [hour, minute] = value.split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : fallback;
}

export function formatTime(minutesSinceMidnight: number, locale: Locale) {
  const hour = Math.floor(minutesSinceMidnight / 60);
  const minute = minutesSinceMidnight % 60;
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit" })
    .format(new Date(2026, 0, 1, hour, minute));
}

export function formatSelectionTime(relativeMinutes: number, openingMinutes: number, locale: Locale) {
  return formatTime(openingMinutes + relativeMinutes, locale);
}

/** Convert an ISO timestamp into minutes relative to the facility's opening time. */
export function facilityMinutes(isoValue: string, openingMinutes: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: facilityTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoValue));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute - openingMinutes;
}

export function selectionStyle(selection: TimeSelection) {
  return {
    top: selection.startMinutes / 60 * hourHeight,
    height: Math.max((selection.endMinutes - selection.startMinutes) / 60 * hourHeight, 2),
  };
}

/** Turn timeline-relative minutes into the absolute timestamps sent to Supabase and calendars. */
export function selectionDateRange(selection: TimeSelection, openingMinutes: number) {
  const startAt = new Date(selection.date);
  const selectedStartMinutes = openingMinutes + selection.startMinutes;
  startAt.setHours(Math.floor(selectedStartMinutes / 60), selectedStartMinutes % 60, 0, 0);

  const endAt = new Date(selection.date);
  const selectedEndMinutes = openingMinutes + selection.endMinutes;
  endAt.setHours(Math.floor(selectedEndMinutes / 60), selectedEndMinutes % 60, 0, 0);

  return { startAt, endAt };
}
