"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";

type CalendarView = "day" | "week";
type CourtSlot = { id: string; start: string; end: string; status: "available" | "booked"; date: Date };

const hourHeight = 64;
const startHour = 8;
const hours = Array.from({ length: 14 }, (_, index) => startHour + index);

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatTime(hour: number) {
  if (hour === 12) return "12 PM";
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
}

function minutesFromStart(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (hour - startHour) * 60 + minute;
}

function slotsForDate(date: Date): CourtSlot[] {
  const key = dateKey(date);
  return [
    { id: `${key}-morning`, date, start: "09:00", end: "10:00", status: date.getDate() % 3 === 0 ? "booked" : "available" },
    { id: `${key}-midday`, date, start: "12:00", end: "13:30", status: "booked" },
    { id: `${key}-afternoon`, date, start: "15:00", end: "16:00", status: "available" },
  ];
}

export function BookingExperience() {
  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const [view, setView] = useState<CalendarView>("day");
  const [focusDate, setFocusDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<CourtSlot | null>(null);

  const visibleDays = useMemo(() => {
    if (view === "day") return [focusDate];
    const weekStart = startOfWeek(focusDate);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [focusDate, view]);

  const title = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(focusDate);

  function move(direction: number) {
    setFocusDate((current) => addDays(current, direction * (view === "day" ? 1 : 7)));
    setSelectedSlot(null);
  }

  return (
    <section className="gcal" aria-label="Court availability calendar">
      <div className="gcal__toolbar">
        <div className="gcal__navigation">
          <button className="gcal__today" type="button" onClick={() => { setFocusDate(today); setSelectedSlot(null); }}>Today</button>
          <button className="gcal__icon-button" type="button" aria-label={`Previous ${view}`} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" size={20} /></button>
          <button className="gcal__icon-button" type="button" aria-label={`Next ${view}`} onClick={() => move(1)}><ChevronRight aria-hidden="true" size={20} /></button>
          <h1>{title}</h1>
        </div>
        <label className="gcal__view-menu">
          <span className="sr-only">Calendar view</span>
          <select value={view} onChange={(event) => { setView(event.target.value as CalendarView); setSelectedSlot(null); }}>
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
          <ChevronDown aria-hidden="true" size={18} />
        </label>
      </div>

      <div className={`gcal__viewport gcal__viewport--${view}`}>
        <div className="gcal__date-header">
          <div className="gcal__timezone">GMT+3</div>
          <div className="gcal__date-columns" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(${view === "week" ? "110px" : "240px"}, 1fr))` }}>
            {visibleDays.map((day) => {
              const isToday = dateKey(day) === dateKey(today);
              return (
                <button key={dateKey(day)} type="button" className={isToday ? "is-today" : ""} onClick={() => { setFocusDate(day); if (view === "week") setView("day"); }}>
                  <span>{new Intl.DateTimeFormat("en", { weekday: "short" }).format(day).toUpperCase()}</span>
                  <strong>{day.getDate()}</strong>
                </button>
              );
            })}
          </div>
        </div>

        <div className="gcal__all-day">
          <span>all-day</span>
          <div className="gcal__all-day-columns" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(${view === "week" ? "110px" : "240px"}, 1fr))` }}>
            {visibleDays.map((day) => <i key={dateKey(day)} />)}
          </div>
        </div>

        <div className="gcal__scroll-area">
          <div className="gcal__time-gutter" style={{ height: hours.length * hourHeight }}>
            {hours.map((hour) => <time key={hour} style={{ top: (hour - startHour) * hourHeight }}>{formatTime(hour)}</time>)}
          </div>
          <div className="gcal__day-columns" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(${view === "week" ? "110px" : "240px"}, 1fr))`, height: hours.length * hourHeight }}>
            {visibleDays.map((day) => {
              const isToday = dateKey(day) === dateKey(today);
              const now = new Date();
              const nowMinutes = (now.getHours() - startHour) * 60 + now.getMinutes();
              const showNow = isToday && nowMinutes >= 0 && nowMinutes <= hours.length * 60;
              return (
              <div className="gcal__day-column" key={dateKey(day)}>
                {hours.map((hour) => <i className="gcal__hour-line" key={hour} style={{ top: (hour - startHour) * hourHeight }} />)}
                {showNow && <span className="gcal__now-line" style={{ top: nowMinutes / 60 * hourHeight }}><i /></span>}
                {slotsForDate(day).map((slot) => {
                  const top = minutesFromStart(slot.start) / 60 * hourHeight;
                  const height = (minutesFromStart(slot.end) - minutesFromStart(slot.start)) / 60 * hourHeight;
                  const selected = selectedSlot?.id === slot.id;
                  return (
                    <button
                      className={`gcal__event gcal__event--${slot.status}${selected ? " is-selected" : ""}`}
                      disabled={slot.status === "booked"}
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot)}
                      style={{ top, height }}
                      type="button"
                      aria-pressed={selected}
                    >
                      <strong>{slot.status === "booked" ? "Booked" : "Available"}</strong>
                      <span>{slot.start}–{slot.end}</span>
                    </button>
                  );
                })}
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedSlot && (
        <aside className="gcal__booking-popover" aria-label="Selected booking time">
          <button className="gcal__popover-close" type="button" aria-label="Close" onClick={() => setSelectedSlot(null)}><X aria-hidden="true" size={20} /></button>
          <i aria-hidden="true" />
          <div>
            <strong>Available court</strong>
            <span>{new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(selectedSlot.date)} · {selectedSlot.start}–{selectedSlot.end}</span>
          </div>
          <button className="button button--primary" type="button">Continue</button>
        </aside>
      )}
    </section>
  );
}
