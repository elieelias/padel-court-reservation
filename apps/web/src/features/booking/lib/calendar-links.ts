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

export function googleCalendarUrl({ startAt, endAt, occurrenceCount = 1 }: CalendarReservation) {
  const parameters = new URLSearchParams({
    action: "TEMPLATE",
    text: `${facilityName} reservation`,
    dates: `${utcCalendarTimestamp(startAt)}/${utcCalendarTimestamp(endAt)}`,
    details: `Padel reservation managed in Padel One. ${siteUrl}/book#upcoming-reservations`,
    location: facilityName,
  });
  if (occurrenceCount > 1) parameters.set("recur", `RRULE:FREQ=WEEKLY;COUNT=${occurrenceCount}`);
  return `https://calendar.google.com/calendar/render?${parameters.toString()}`;
}

export function appleCalendarFile({ startAt, endAt, occurrenceCount = 1 }: CalendarReservation) {
  const start = utcCalendarTimestamp(startAt);
  const recurrence = occurrenceCount > 1 ? `RRULE:FREQ=WEEKLY;COUNT=${occurrenceCount}\r\n` : "";
  const uid = `padel-one-${start}-${occurrenceCount}@padel-one`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Padel One//Reservation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${utcCalendarTimestamp(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${utcCalendarTimestamp(endAt)}`,
    `SUMMARY:${escapeCalendarText(`${facilityName} reservation`)}`,
    `LOCATION:${escapeCalendarText(facilityName)}`,
    `DESCRIPTION:${escapeCalendarText(`Padel reservation managed in Padel One. ${siteUrl}/book#upcoming-reservations`)}`,
    recurrence.trimEnd(),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].filter(Boolean).join("\r\n");
}
