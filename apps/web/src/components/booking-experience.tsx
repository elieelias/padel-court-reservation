"use client";

import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CalendarDays, CheckCircle2, Clock3, X } from "lucide-react";
import Link from "next/link";
import { facilityName } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

type CourtSlot = { id: string; start: number; end: number };
type TimeSelection = { date: Date; startMinutes: number; endMinutes: number };
type DragState = TimeSelection & { pointerId: number; anchorMinutes: number };
type ConfirmationState = "idle" | "saving" | "success" | "error";
type AvailabilityState = "loading" | "ready" | "error";
type AvailabilityRow = { start_at: string; end_at: string };

const hourHeight = 64;
const openingHour = 16;
const closingHour = 22;
const snapMinutes = 30;
const minimumReservationMinutes = 60;
const totalOpenMinutes = (closingHour - openingHour) * 60;
const calendarHeight = (closingHour - openingHour) * hourHeight;
const timeLabels = Array.from({ length: closingHour - openingHour + 1 }, (_, index) => openingHour + index);
const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];
const facilityTimeZone = "Asia/Beirut";

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function addMonth(date: Date) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function databaseDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatHour(hour: number) {
  if (hour === 12) return "12 PM";
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
}

function formatSelectionTime(relativeMinutes: number) {
  const minutesSinceMidnight = openingHour * 60 + relativeMinutes;
  const hour = Math.floor(minutesSinceMidnight / 60);
  const minute = minutesSinceMidnight % 60;
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${period}`;
}

function facilityMinutes(isoValue: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: facilityTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoValue));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return (hour - openingHour) * 60 + minute;
}

function unavailableRanges(availableStarts: Set<number>) {
  const unavailable: CourtSlot[] = [];
  let rangeStart: number | null = null;

  for (let minute = 0; minute < totalOpenMinutes; minute += snapMinutes) {
    if (!availableStarts.has(minute) && rangeStart === null) rangeStart = minute;
    if (availableStarts.has(minute) && rangeStart !== null) {
      unavailable.push({ id: `${rangeStart}-${minute}`, start: rangeStart, end: minute });
      rangeStart = null;
    }
  }
  if (rangeStart !== null) unavailable.push({ id: `${rangeStart}-${totalOpenMinutes}`, start: rangeStart, end: totalOpenMinutes });
  return unavailable;
}

function selectionStyle(selection: TimeSelection) {
  return {
    top: selection.startMinutes / 60 * hourHeight,
    height: Math.max((selection.endMinutes - selection.startMinutes) / 60 * hourHeight, 2),
  };
}

export function BookingExperience() {
  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const bookingLimit = useMemo(() => addMonth(today), [today]);
  const calendarDays = useMemo(() => {
    const firstCell = startOfWeek(today);
    const dayCount = Math.round((bookingLimit.getTime() - firstCell.getTime()) / 86_400_000) + 1;
    return Array.from({ length: dayCount }, (_, index) => addDays(firstCell, index));
  }, [bookingLimit, today]);
  const [focusDate, setFocusDate] = useState(today);
  const [selectedTime, setSelectedTime] = useState<TimeSelection | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [calendarMessage, setCalendarMessage] = useState("");
  const [availableStarts, setAvailableStarts] = useState<Set<number>>(new Set());
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("loading");
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [openCourt, setOpenCourt] = useState(false);
  const [existingPlayers, setExistingPlayers] = useState(1);
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>("idle");
  const [confirmationMessage, setConfirmationMessage] = useState("");

  useEffect(() => {
    let active = true;
    void createClient().rpc("get_available_slots", { p_date: databaseDate(focusDate) }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAvailableStarts(new Set());
        setAvailabilityState("error");
        setCalendarMessage("Availability could not be loaded. Please refresh and try again.");
        return;
      }
      const starts = new Set((data as AvailabilityRow[] | null)?.map((slot) => facilityMinutes(slot.start_at)) ?? []);
      setAvailableStarts(starts);
      setAvailabilityState("ready");
    });

    return () => { active = false; };
  }, [availabilityVersion, focusDate]);

  const bookedSlots = useMemo(
    () => availabilityState === "ready" ? unavailableRanges(availableStarts) : [],
    [availabilityState, availableStarts],
  );
  const rangeLabel = `${new Intl.DateTimeFormat("en", { month: "long", day: "numeric" }).format(today)} – ${new Intl.DateTimeFormat("en", { month: "long", day: "numeric" }).format(bookingLimit)}`;
  const selectedDateLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(focusDate);
  const activeSelection = drag ?? selectedTime;

  function isRangeAvailable(selection: TimeSelection) {
    if (availabilityState !== "ready") return false;
    for (let minute = selection.startMinutes; minute < selection.endMinutes; minute += snapMinutes) {
      if (!availableStarts.has(minute)) return false;
    }
    return true;
  }

  const selectionIsInvalid = Boolean(activeSelection && !isRangeAvailable(activeSelection));

  function clearSelection() {
    setSelectedTime(null);
    setDrag(null);
    setCalendarMessage("");
    setOpenCourt(false);
    setExistingPlayers(1);
    setConfirmationState("idle");
    setConfirmationMessage("");
  }

  function dismissConfirmation() {
    setSelectedTime(null);
    setOpenCourt(false);
    setExistingPlayers(1);
    setConfirmationState("idle");
    setConfirmationMessage("");
  }

  async function confirmReservation() {
    if (!selectedTime || confirmationState === "saving" || !isRangeAvailable(selectedTime)) return;
    setConfirmationState("saving");
    setConfirmationMessage("");

    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setConfirmationState("error");
      setConfirmationMessage("Please sign in again before confirming this reservation.");
      return;
    }

    const startAt = new Date(selectedTime.date);
    startAt.setHours(openingHour + Math.floor(selectedTime.startMinutes / 60), selectedTime.startMinutes % 60, 0, 0);
    const endAt = new Date(selectedTime.date);
    endAt.setHours(openingHour + Math.floor(selectedTime.endMinutes / 60), selectedTime.endMinutes % 60, 0, 0);

    const { error } = await supabase.rpc("create_reservation", {
      p_start_at: startAt.toISOString(),
      p_end_at: endAt.toISOString(),
      p_type: openCourt ? "open" : "private",
      p_initial_player_count: openCourt ? existingPlayers : 1,
    });

    if (error) {
      setConfirmationState("error");
      setConfirmationMessage(error.message || "The reservation could not be confirmed. Please try again.");
      setAvailabilityVersion((value) => value + 1);
      return;
    }

    setConfirmationState("success");
    setConfirmationMessage("Your court is reserved and now appears in your profile.");
    setAvailabilityVersion((value) => value + 1);
  }

  function chooseDate(date: Date) {
    setAvailabilityState("loading");
    setFocusDate(date);
    clearSelection();
  }

  function pointToMinutes(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const rawMinutes = (event.clientY - bounds.top) / bounds.height * totalOpenMinutes;
    return Math.min(totalOpenMinutes, Math.max(0, Math.round(rawMinutes / snapMinutes) * snapMinutes));
  }

  function selectionFromPointer(anchorMinutes: number, currentMinutes: number): TimeSelection {
    const defaultEnd = anchorMinutes + minimumReservationMinutes;
    if (currentMinutes < anchorMinutes) {
      return { date: focusDate, startMinutes: currentMinutes, endMinutes: defaultEnd };
    }
    return {
      date: focusDate,
      startMinutes: anchorMinutes,
      endMinutes: Math.min(totalOpenMinutes, Math.max(defaultEnd, currentMinutes)),
    };
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    if (availabilityState !== "ready") {
      setCalendarMessage(availabilityState === "loading" ? "Loading availability…" : "Availability is not available right now.");
      return;
    }
    const anchorMinutes = Math.min(pointToMinutes(event), totalOpenMinutes - minimumReservationMinutes);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedTime(null);
    setCalendarMessage("");
    setConfirmationState("idle");
    setConfirmationMessage("");
    setDrag({
      date: focusDate,
      pointerId: event.pointerId,
      anchorMinutes,
      startMinutes: anchorMinutes,
      endMinutes: anchorMinutes + minimumReservationMinutes,
    });
  }

  function updateDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextSelection = selectionFromPointer(drag.anchorMinutes, pointToMinutes(event));
    setDrag((current) => current ? { ...current, ...nextSelection } : null);
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextSelection = selectionFromPointer(drag.anchorMinutes, pointToMinutes(event));
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);

    if (!isRangeAvailable(nextSelection)) {
      setCalendarMessage("That time is unavailable. Choose a clear one-hour block or longer.");
      return;
    }
    setCalendarMessage("");
    setSelectedTime(nextSelection);
  }

  function cancelDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag?.pointerId === event.pointerId) setDrag(null);
  }

  return (
    <section className="booking-calendar" aria-label="Court availability calendar">
      <header className="booking-calendar__intro">
        <h1>Book a court</h1>
        <p>Choose a date, then drag to select your time.</p>
      </header>

      <section className="booking-date-picker" aria-label={`Available dates from ${rangeLabel}`}>
        <div className="booking-date-picker__title"><strong>{rangeLabel}</strong><span>One month ahead</span></div>
        <div className="booking-date-picker__weekdays" aria-hidden="true">
          {weekdayLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
        </div>
        <div className="booking-date-picker__days">
          {calendarDays.map((day) => {
            const isBeforeToday = day < today;
            const isSelected = dateKey(day) === dateKey(focusDate);
            const isToday = dateKey(day) === dateKey(today);
            const isNextMonth = day.getMonth() !== today.getMonth();
            return (
              <button
                aria-label={new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(day)}
                aria-pressed={isSelected}
                className={`${isSelected ? "is-selected " : ""}${isToday ? "is-today " : ""}${isNextMonth ? "is-next-month" : ""}`.trim()}
                disabled={isBeforeToday}
                key={dateKey(day)}
                onClick={() => chooseDate(day)}
                type="button"
              >{day.getDate()}</button>
            );
          })}
        </div>
      </section>

      <section className="booking-time-section" aria-labelledby="available-times-heading">
        <div className="booking-time-section__heading">
          <div><h2 id="available-times-heading">Available times</h2><strong>{selectedDateLabel}</strong></div>
          <span>{availabilityState === "loading" ? "Loading…" : selectedTime ? `${formatSelectionTime(selectedTime.startMinutes)} – ${formatSelectionTime(selectedTime.endMinutes)}` : `${formatHour(openingHour)} – ${formatHour(closingHour)}`}</span>
        </div>
        <div className="booking-time-grid">
          <div className="booking-time-grid__gutter" style={{ height: calendarHeight }}>
            {timeLabels.map((hour) => <time key={hour} style={{ top: (hour - openingHour) * hourHeight }}>{formatHour(hour)}</time>)}
          </div>
          <div
            aria-busy={availabilityState === "loading"}
            aria-label={`${selectedDateLabel}. Facility open ${formatHour(openingHour)} to ${formatHour(closingHour)}. Drag to select a time.`}
            className="booking-time-grid__day"
            onPointerCancel={cancelDrag}
            onPointerDown={startDrag}
            onPointerMove={updateDrag}
            onPointerUp={finishDrag}
            style={{ height: calendarHeight }}
          >
            {timeLabels.slice(0, -1).flatMap((hour) => [
              <i className="booking-time-grid__hour-line" key={`${hour}-hour`} style={{ top: (hour - openingHour) * hourHeight }} />,
              <i className="booking-time-grid__half-hour-line" key={`${hour}-half`} style={{ top: (hour - openingHour + .5) * hourHeight }} />,
            ])}
            {bookedSlots.map((slot) => (
              <article className="booking-time-grid__event" key={slot.id} style={{ top: slot.start / 60 * hourHeight, height: (slot.end - slot.start) / 60 * hourHeight }}>
                <strong>Unavailable</strong><span>{formatSelectionTime(slot.start)}–{formatSelectionTime(slot.end)}</span>
              </article>
            ))}
            {activeSelection && (
              <div className={`booking-time-grid__selection${selectionIsInvalid ? " is-invalid" : ""}`} style={selectionStyle(activeSelection)}>
                <strong>{selectionIsInvalid ? "Unavailable" : "Selected"}</strong>
                <span>{formatSelectionTime(activeSelection.startMinutes)} – {formatSelectionTime(activeSelection.endMinutes)}</span>
              </div>
            )}
          </div>
        </div>
        <p className="booking-time-section__status" aria-live="polite">{calendarMessage}</p>
      </section>

      {selectedTime && (
        <>
          <button className="sheet-backdrop booking-sheet-backdrop is-open" disabled={confirmationState === "saving"} type="button" aria-label="Close booking confirmation" onClick={dismissConfirmation} />
          <aside className="confirmation-sheet booking-confirmation-sheet is-open" aria-labelledby="confirm-booking-heading">
            <div className="sheet-handle" aria-hidden="true" />
            {confirmationState === "success" ? (
              <div className="booking-confirmation-success">
                <span className="booking-confirmation-success__icon"><CheckCircle2 aria-hidden="true" size={28} /></span>
                <div><h2 id="confirm-booking-heading">Reservation confirmed</h2><p>{confirmationMessage}</p></div>
                <div className="confirmation-detail">
                  <div className="confirmation-detail__icon"><CalendarDays aria-hidden="true" size={23} /></div>
                  <div><strong>{facilityName}</strong><span>{selectedDateLabel}</span><span>{formatSelectionTime(selectedTime.startMinutes)} – {formatSelectionTime(selectedTime.endMinutes)}</span></div>
                </div>
                <Link className="button button--primary confirmation-action" href="/profile#reservations">View reservation</Link>
                <button className="button booking-confirmation-sheet__cancel" type="button" onClick={clearSelection}>Done</button>
              </div>
            ) : (
              <>
                <div className="sheet-heading">
                  <h2 id="confirm-booking-heading">Confirm Booking</h2>
                  <button className="sheet-close" disabled={confirmationState === "saving"} type="button" aria-label="Close" onClick={dismissConfirmation}><X aria-hidden="true" size={20} /></button>
                </div>
                <div className="confirmation-detail">
                  <div className="confirmation-detail__icon"><CalendarDays aria-hidden="true" size={23} /></div>
                  <div><strong>{facilityName}</strong><span>{selectedDateLabel}</span><span>{formatSelectionTime(selectedTime.startMinutes)} – {formatSelectionTime(selectedTime.endMinutes)}</span></div>
                </div>
                <label className="open-court-toggle">
                  <span><strong>Open Court</strong><small>Allow other players in the community to join your reservation.</small></span>
                  <input type="checkbox" checked={openCourt} disabled={confirmationState === "saving"} onChange={(event) => { setOpenCourt(event.target.checked); if (!event.target.checked) setExistingPlayers(1); }} />
                  <i aria-hidden="true" />
                </label>
                {openCourt && (
                  <div className="booking-player-count">
                    <div><strong>Players already in this reservation</strong><span>{existingPlayers} of 4 players</span></div>
                    <div className="booking-player-count__options" role="group" aria-label="Players already in this reservation">
                      {[1, 2, 3].map((count) => <button aria-pressed={existingPlayers === count} className={existingPlayers === count ? "is-selected" : ""} disabled={confirmationState === "saving"} key={count} onClick={() => setExistingPlayers(count)} type="button">{count}</button>)}
                    </div>
                  </div>
                )}
                {confirmationState === "error" && <p className="booking-confirmation-sheet__message" role="alert">{confirmationMessage}</p>}
                <button className="button button--primary confirmation-action" disabled={confirmationState === "saving" || selectionIsInvalid} onClick={() => void confirmReservation()} type="button">
                  {confirmationState === "saving" ? "Confirming…" : "Confirm Reservation"}
                </button>
                <button className="button booking-confirmation-sheet__cancel" disabled={confirmationState === "saving"} type="button" onClick={dismissConfirmation}>Cancel</button>
              </>
            )}
          </aside>
        </>
      )}

      <div className="booking-calendar__hours-note"><Clock3 aria-hidden="true" size={15} /> Open daily from {formatHour(openingHour)} to {formatHour(closingHour)}</div>
    </section>
  );
}
