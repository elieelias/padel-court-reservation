"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CalendarDays, Check, CheckCircle2, Clock3, Users, X } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { facilityName } from "@/lib/config";
import { intlLocale, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type CourtSlot = { id: string; start: number; end: number };
type TimeSelection = { date: Date; startMinutes: number; endMinutes: number };
type DragState = TimeSelection & { pointerId: number; anchorMinutes: number };
type ConfirmationState = "idle" | "saving" | "success" | "error";
type AvailabilityState = "loading" | "ready" | "error";
type AvailabilityRow = { start_at: string; end_at: string };
type CalendarBlockRow = AvailabilityRow & { block_type: "reserved" | "maintenance" };
type FriendRow = { player_id: string; username: string; status: "pending" | "accepted" | "rejected"; direction: string };

const hourHeight = 64;
const openingHour = 16;
const closingHour = 22;
const snapMinutes = 30;
const minimumReservationMinutes = 60;
const totalOpenMinutes = (closingHour - openingHour) * 60;
const calendarHeight = (closingHour - openingHour) * hourHeight;
const timeLabels = Array.from({ length: closingHour - openingHour + 1 }, (_, index) => openingHour + index);
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

function formatHour(hour: number, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric" }).format(new Date(2026, 0, 1, hour));
}

function formatSelectionTime(relativeMinutes: number, locale: Locale) {
  const minutesSinceMidnight = openingHour * 60 + relativeMinutes;
  const hour = Math.floor(minutesSinceMidnight / 60);
  const minute = minutesSinceMidnight % 60;
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit" }).format(new Date(2026, 0, 1, hour, minute));
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

function selectionStyle(selection: TimeSelection) {
  return {
    top: selection.startMinutes / 60 * hourHeight,
    height: Math.max((selection.endMinutes - selection.startMinutes) / 60 * hourHeight, 2),
  };
}

export function BookingExperience() {
  const { locale, t } = useLanguage();
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
  const weekdayLabels = useMemo(() => Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(intlLocale(locale), { weekday: "narrow" }).format(addDays(startOfWeek(today), index))), [locale, today]);
  const [focusDate, setFocusDate] = useState(today);
  const [selectedTime, setSelectedTime] = useState<TimeSelection | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [calendarMessage, setCalendarMessage] = useState("");
  const [availableStarts, setAvailableStarts] = useState<Set<number>>(new Set());
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlockRow[]>([]);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("loading");
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [openCourt, setOpenCourt] = useState(false);
  const [existingPlayers, setExistingPlayers] = useState(1);
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>("idle");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const dragFrame = useRef<number | null>(null);
  const pendingDragMinutes = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedTime || openCourt) return;
    let active = true;
    void createClient().rpc("list_friendships").then(({ data }) => {
      if (!active) return;
      setFriends(((data as FriendRow[] | null) ?? []).filter((item) => item.status === "accepted"));
      setFriendsLoading(false);
    });
    return () => { active = false; };
  }, [openCourt, selectedTime]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void Promise.all([
      supabase.rpc("get_available_slots", { p_date: databaseDate(focusDate) }),
      supabase.rpc("get_calendar_blocks", { p_date: databaseDate(focusDate) }),
    ]).then(([slotsResult, blocksResult]) => {
      if (!active) return;
      if (slotsResult.error || blocksResult.error) {
        setAvailableStarts(new Set());
        setCalendarBlocks([]);
        setAvailabilityState("error");
        setCalendarMessage(t("booking.availabilityError"));
        return;
      }
      const starts = new Set((slotsResult.data as AvailabilityRow[] | null)?.map((slot) => facilityMinutes(slot.start_at)) ?? []);
      setAvailableStarts(starts);
      setCalendarBlocks((blocksResult.data as CalendarBlockRow[] | null) ?? []);
      setAvailabilityState("ready");
    });

    return () => { active = false; };
  }, [availabilityVersion, focusDate, t]);

  const displayBlocks = useMemo(() => calendarBlocks.map((block, index) => ({
    id: `${block.block_type}-${block.start_at}-${index}`,
    kind: block.block_type,
    start: Math.max(0, facilityMinutes(block.start_at)),
    end: Math.min(totalOpenMinutes, facilityMinutes(block.end_at)),
  })).filter((block) => block.end > block.start), [calendarBlocks]);
  const pastSlot = useMemo<CourtSlot | null>(() => {
    if (dateKey(focusDate) !== dateKey(today)) return null;
    const now = new Date(currentTime);
    const minutes = (now.getHours() - openingHour) * 60 + now.getMinutes();
    const end = Math.min(totalOpenMinutes, Math.max(0, Math.ceil(minutes / snapMinutes) * snapMinutes));
    return end > 0 ? { id: "past", start: 0, end } : null;
  }, [currentTime, focusDate, today]);
  const rangeLabel = `${new Intl.DateTimeFormat(intlLocale(locale), { month: "long", day: "numeric" }).format(today)} – ${new Intl.DateTimeFormat(intlLocale(locale), { month: "long", day: "numeric" }).format(bookingLimit)}`;
  const selectedDateLabel = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", month: "long", day: "numeric" }).format(focusDate);
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
    setSelectedFriendIds([]);
  }

  function dismissConfirmation() {
    setSelectedTime(null);
    setOpenCourt(false);
    setExistingPlayers(1);
    setConfirmationState("idle");
    setConfirmationMessage("");
    setSelectedFriendIds([]);
  }

  async function confirmReservation() {
    if (!selectedTime || confirmationState === "saving" || !isRangeAvailable(selectedTime)) return;
    setConfirmationState("saving");
    setConfirmationMessage("");

    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setConfirmationState("error");
      setConfirmationMessage(t("booking.signInAgain"));
      return;
    }

    const startAt = new Date(selectedTime.date);
    startAt.setHours(openingHour + Math.floor(selectedTime.startMinutes / 60), selectedTime.startMinutes % 60, 0, 0);
    const endAt = new Date(selectedTime.date);
    endAt.setHours(openingHour + Math.floor(selectedTime.endMinutes / 60), selectedTime.endMinutes % 60, 0, 0);

    const { error } = openCourt
      ? await supabase.rpc("create_reservation", {
          p_start_at: startAt.toISOString(),
          p_end_at: endAt.toISOString(),
          p_type: "open",
          p_initial_player_count: existingPlayers,
        })
      : await supabase.rpc("create_private_reservation", {
          p_start_at: startAt.toISOString(),
          p_end_at: endAt.toISOString(),
          p_friend_ids: selectedFriendIds,
        });

    if (error) {
      setConfirmationState("error");
      setConfirmationMessage(locale === "ar" ? t("booking.reserveError") : error.message || t("booking.reserveError"));
      setAvailabilityVersion((value) => value + 1);
      return;
    }

    setConfirmationState("success");
    setConfirmationMessage(t("booking.successMessage"));
    setAvailabilityVersion((value) => value + 1);
  }

  function chooseDate(date: Date) {
    setAvailabilityState("loading");
    setFocusDate(date);
    clearSelection();
  }

  function toggleFriend(playerId: string) {
    setSelectedFriendIds((current) => current.includes(playerId)
      ? current.filter((id) => id !== playerId)
      : current.length < 3 ? [...current, playerId] : current);
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
      setCalendarMessage(availabilityState === "loading" ? t("booking.loadingAvailability") : t("booking.availabilityUnavailable"));
      return;
    }
    const anchorMinutes = Math.min(pointToMinutes(event), totalOpenMinutes - minimumReservationMinutes);
    const initialSelection = { date: focusDate, startMinutes: anchorMinutes, endMinutes: anchorMinutes + minimumReservationMinutes };
    if (!isRangeAvailable(initialSelection)) {
      setCalendarMessage(t("booking.unavailableSelection"));
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedTime(null);
    setCalendarMessage("");
    setConfirmationState("idle");
    setConfirmationMessage("");
    setDrag({
      ...initialSelection,
      pointerId: event.pointerId,
      anchorMinutes,
    });
  }

  function updateDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    pendingDragMinutes.current = pointToMinutes(event);
    if (dragFrame.current !== null) return;
    dragFrame.current = window.requestAnimationFrame(() => {
      dragFrame.current = null;
      const nextMinutes = pendingDragMinutes.current;
      if (nextMinutes === null) return;
      setDrag((current) => current ? { ...current, ...selectionFromPointer(current.anchorMinutes, nextMinutes) } : null);
    });
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextSelection = selectionFromPointer(drag.anchorMinutes, pointToMinutes(event));
    if (dragFrame.current !== null) window.cancelAnimationFrame(dragFrame.current);
    dragFrame.current = null;
    pendingDragMinutes.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);

    if (!isRangeAvailable(nextSelection)) {
      setCalendarMessage(t("booking.unavailableSelection"));
      return;
    }
    setCalendarMessage("");
    setSelectedTime(nextSelection);
  }

  function cancelDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag?.pointerId === event.pointerId) {
      if (dragFrame.current !== null) window.cancelAnimationFrame(dragFrame.current);
      dragFrame.current = null;
      pendingDragMinutes.current = null;
      setDrag(null);
    }
  }

  return (
    <section className="booking-calendar" aria-label={t("booking.calendarLabel")}>
      <header className="booking-calendar__intro">
        <h1>{t("booking.title")}</h1>
        <p>{t("booking.intro")}</p>
      </header>

      <section className="booking-date-picker" aria-label={t("booking.rangeLabel", { range: rangeLabel })}>
        <div className="booking-date-picker__title"><strong>{rangeLabel}</strong><span>{t("booking.oneMonth")}</span></div>
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
                aria-label={new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", month: "long", day: "numeric" }).format(day)}
                aria-pressed={isSelected}
                className={`${isSelected ? "is-selected " : ""}${isToday ? "is-today " : ""}${isNextMonth ? "is-next-month" : ""}`.trim()}
                disabled={isBeforeToday}
                key={dateKey(day)}
                onClick={() => chooseDate(day)}
                type="button"
              >{new Intl.NumberFormat(intlLocale(locale), { useGrouping: false }).format(day.getDate())}</button>
            );
          })}
        </div>
      </section>

      <section className="booking-time-section" aria-labelledby="available-times-heading">
        <div className="booking-time-section__heading">
          <div><h2 id="available-times-heading">{t("booking.availableTimes")}</h2><strong>{selectedDateLabel}</strong></div>
          <span>{availabilityState === "loading" ? t("common.loading") : selectedTime ? `${formatSelectionTime(selectedTime.startMinutes, locale)} – ${formatSelectionTime(selectedTime.endMinutes, locale)}` : `${formatHour(openingHour, locale)} – ${formatHour(closingHour, locale)}`}</span>
        </div>
        <div className="booking-time-grid">
          <div className="booking-time-grid__gutter" style={{ height: calendarHeight }}>
            {timeLabels.map((hour) => <time key={hour} style={{ top: (hour - openingHour) * hourHeight }}>{formatHour(hour, locale)}</time>)}
          </div>
          <div
            aria-busy={availabilityState === "loading"}
            aria-label={t("booking.dayLabel", { date: selectedDateLabel, start: formatHour(openingHour, locale), end: formatHour(closingHour, locale) })}
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
            {pastSlot && <article className="booking-time-grid__event is-past" style={{ top: 0, height: pastSlot.end / 60 * hourHeight }}><strong>{t("booking.past")}</strong></article>}
            {displayBlocks.map((slot) => (
              <article className={`booking-time-grid__event is-${slot.kind}`} key={slot.id} style={{ top: slot.start / 60 * hourHeight, height: (slot.end - slot.start) / 60 * hourHeight }}>
                <strong>{slot.kind === "reserved" ? t("booking.reserved") : t("booking.maintenance")}</strong><span>{formatSelectionTime(slot.start, locale)}–{formatSelectionTime(slot.end, locale)}</span>
              </article>
            ))}
            {activeSelection && (
              <div className={`booking-time-grid__selection${selectionIsInvalid ? " is-invalid" : ""}`} style={selectionStyle(activeSelection)}>
                <strong>{selectionIsInvalid ? t("booking.unavailable") : t("booking.selected")}</strong>
                <span>{formatSelectionTime(activeSelection.startMinutes, locale)} – {formatSelectionTime(activeSelection.endMinutes, locale)}</span>
              </div>
            )}
          </div>
        </div>
        <p className="booking-time-section__status" aria-live="polite">{calendarMessage}</p>
      </section>

      {selectedTime && (
        <>
          <button className="sheet-backdrop booking-sheet-backdrop is-open" disabled={confirmationState === "saving"} type="button" aria-label={t("booking.closeConfirmation")} onClick={dismissConfirmation} />
          <aside className="confirmation-sheet booking-confirmation-sheet is-open" aria-labelledby="confirm-booking-heading">
            <div className="sheet-handle" aria-hidden="true" />
            {confirmationState === "success" ? (
              <div className="booking-confirmation-success">
                <span className="booking-confirmation-success__icon"><CheckCircle2 aria-hidden="true" size={28} /></span>
                <div><h2 id="confirm-booking-heading">{t("booking.successTitle")}</h2><p>{confirmationMessage}</p></div>
                <div className="confirmation-detail">
                  <div className="confirmation-detail__icon"><CalendarDays aria-hidden="true" size={23} /></div>
                  <div><strong>{facilityName}</strong><span>{selectedDateLabel}</span><span>{formatSelectionTime(selectedTime.startMinutes, locale)} – {formatSelectionTime(selectedTime.endMinutes, locale)}</span></div>
                </div>
                <Link className="button button--primary confirmation-action" href="/book#upcoming-reservations">{t("booking.viewReservation")}</Link>
                <button className="button booking-confirmation-sheet__cancel" type="button" onClick={clearSelection}>{t("booking.done")}</button>
              </div>
            ) : (
              <>
                <div className="sheet-heading">
                  <h2 id="confirm-booking-heading">{t("booking.confirmTitle")}</h2>
                  <button className="sheet-close" disabled={confirmationState === "saving"} type="button" aria-label={t("common.close")} onClick={dismissConfirmation}><X aria-hidden="true" size={20} /></button>
                </div>
                <div className="confirmation-detail">
                  <div className="confirmation-detail__icon"><CalendarDays aria-hidden="true" size={23} /></div>
                  <div><strong>{facilityName}</strong><span>{selectedDateLabel}</span><span>{formatSelectionTime(selectedTime.startMinutes, locale)} – {formatSelectionTime(selectedTime.endMinutes, locale)}</span></div>
                </div>
                <label className="open-court-toggle">
                  <span><strong>{t("booking.openCourt")}</strong><small>{t("booking.openCourtHelp")}</small></span>
                  <input type="checkbox" checked={openCourt} disabled={confirmationState === "saving"} onChange={(event) => { setOpenCourt(event.target.checked); setSelectedFriendIds([]); if (!event.target.checked) setExistingPlayers(1); }} />
                  <i aria-hidden="true" />
                </label>
                {openCourt && (
                  <div className="booking-player-count">
                    <div><strong>{t("booking.playersAlready")}</strong><span>{t("booking.playersOfFour", { count: existingPlayers })}</span></div>
                    <div className="booking-player-count__options" role="group" aria-label={t("booking.playersAlready")}>
                      {[1, 2, 3].map((count) => <button aria-pressed={existingPlayers === count} className={existingPlayers === count ? "is-selected" : ""} disabled={confirmationState === "saving"} key={count} onClick={() => setExistingPlayers(count)} type="button">{count}</button>)}
                    </div>
                  </div>
                )}
                {!openCourt && (
                  <div className="booking-friend-picker">
                    <div className="booking-friend-picker__heading"><span><Users aria-hidden="true" size={18} /><strong>{t("booking.addFriends")}</strong></span><small>{t("booking.friendCount", { count: selectedFriendIds.length })}</small></div>
                    <p>{t("booking.addFriendsHelp")}</p>
                    {friendsLoading ? <span className="booking-friend-picker__empty">{t("common.loading")}</span> : friends.length ? (
                      <div className="booking-friend-picker__list">
                        {friends.map((friend) => {
                          const selected = selectedFriendIds.includes(friend.player_id);
                          return <button aria-pressed={selected} className={selected ? "is-selected" : ""} disabled={confirmationState === "saving" || (!selected && selectedFriendIds.length >= 3)} key={friend.player_id} onClick={() => toggleFriend(friend.player_id)} type="button"><span>{friend.username.slice(0, 1).toUpperCase()}</span><strong>@{friend.username}</strong>{selected && <Check aria-hidden="true" size={17} />}</button>;
                        })}
                      </div>
                    ) : <span className="booking-friend-picker__empty">{t("booking.noFriends")} <Link href="/profile">{t("booking.addFriendsLink")}</Link></span>}
                  </div>
                )}
                {confirmationState === "error" && <p className="booking-confirmation-sheet__message" role="alert">{confirmationMessage}</p>}
                <button className="button button--primary confirmation-action" disabled={confirmationState === "saving" || selectionIsInvalid || (!openCourt && selectedFriendIds.length < 2)} onClick={() => void confirmReservation()} type="button">
                  {confirmationState === "saving" ? t("booking.confirming") : t("booking.confirm")}
                </button>
                <button className="button booking-confirmation-sheet__cancel" disabled={confirmationState === "saving"} type="button" onClick={dismissConfirmation}>{t("common.cancel")}</button>
              </>
            )}
          </aside>
        </>
      )}

      <div className="booking-calendar__hours-note"><Clock3 aria-hidden="true" size={15} /> {t("booking.openDaily", { start: formatHour(openingHour, locale), end: formatHour(closingHour, locale) })}</div>
    </section>
  );
}
