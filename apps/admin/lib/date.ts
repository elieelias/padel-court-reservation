// Converts, validates, and formats dates and times in the facility timezone.

const facilityTimeZone = 'Asia/Beirut';

function zonedParts(value: Date, timeZone = facilityTimeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function todayKey(timeZone = facilityTimeZone) {
  const parts = zonedParts(new Date(), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftDateKey(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

export function dateKeyDayOfWeek(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function zonedDateTimeToIso(dateKey: string, time: string, timeZone = facilityTimeZone) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstParts = zonedParts(new Date(guess), timeZone);
  const represented = Date.UTC(
    Number(firstParts.year),
    Number(firstParts.month) - 1,
    Number(firstParts.day),
    Number(firstParts.hour),
    Number(firstParts.minute),
    Number(firstParts.second),
  );
  const firstResult = guess - (represented - guess);
  const secondParts = zonedParts(new Date(firstResult), timeZone);
  const secondRepresented = Date.UTC(
    Number(secondParts.year),
    Number(secondParts.month) - 1,
    Number(secondParts.day),
    Number(secondParts.hour),
    Number(secondParts.minute),
    Number(secondParts.second),
  );
  return new Date(firstResult - (secondRepresented - guess)).toISOString();
}

export function dayBounds(dateKey: string, timeZone = facilityTimeZone) {
  return {
    start: zonedDateTimeToIso(dateKey, '00:00', timeZone),
    end: zonedDateTimeToIso(shiftDateKey(dateKey, 1), '00:00', timeZone),
  };
}

export function formatDayHeading(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  return {
    numeral: String(day).padStart(2, '0'),
    weekday: new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(value),
    monthYear: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(value),
    long: new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(value),
  };
}

export function formatTime(value: string, timeZone = facilityTimeZone) {
  return new Intl.DateTimeFormat('en', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatTimeRange(startAt: string, endAt: string, timeZone = facilityTimeZone) {
  return `${formatTime(startAt, timeZone)}–${formatTime(endAt, timeZone)}`;
}

export function formatDateTime(value: string, timeZone = facilityTimeZone) {
  return new Intl.DateTimeFormat('en', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function inputTime(value: string, timeZone = facilityTimeZone) {
  const parts = zonedParts(new Date(value), timeZone);
  return `${parts.hour}:${parts.minute}`;
}

export function inputDate(value: string, timeZone = facilityTimeZone) {
  const parts = zonedParts(new Date(value), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

export function isTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}
