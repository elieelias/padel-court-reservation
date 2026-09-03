import { facilityName, siteUrl } from "@/lib/config";

export type CalendarReservation = {
  startAt: Date | string;
  endAt: Date | string;
  occurrenceCount?: number;
};

function utcCalendarTimestamp(value: Date | string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeCalendarText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function googleCalendarUrl({ startAt, endAt, occurrenceCount = 1 }: CalendarReservation, displayName = facilityName) {
  const parameters = new URLSearchParams({
    action: "TEMPLATE",
    text: `${displayName} reservation`,
    dates: `${utcCalendarTimestamp(startAt)}/${utcCalendarTimestamp(endAt)}`,
    details: `Padel reservation managed by ${displayName}. ${siteUrl}/book#upcoming-reservations`,
    location: displayName,
  });
  if (occurrenceCount > 1) parameters.set("recur", `RRULE:FREQ=WEEKLY;COUNT=${occurrenceCount}`);
  return `https://calendar.google.com/calendar/render?${parameters.toString()}`;
}

export function appleCalendarFile({ startAt, endAt, occurrenceCount = 1 }: CalendarReservation, displayName = facilityName) {
  const start = utcCalendarTimestamp(startAt);
  const recurrence = occurrenceCount > 1 ? `RRULE:FREQ=WEEKLY;COUNT=${occurrenceCount}\r\n` : "";
  const uid = `padel-reservation-${start}-${occurrenceCount}@padel-reservation`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapeCalendarText(displayName)}//Reservation//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${utcCalendarTimestamp(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${utcCalendarTimestamp(endAt)}`,
    `SUMMARY:${escapeCalendarText(`${displayName} reservation`)}`,
    `LOCATION:${escapeCalendarText(displayName)}`,
    `DESCRIPTION:${escapeCalendarText(`Padel reservation managed by ${displayName}. ${siteUrl}/book#upcoming-reservations`)}`,
    recurrence.trimEnd(),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].filter(Boolean).join("\r\n");
}
