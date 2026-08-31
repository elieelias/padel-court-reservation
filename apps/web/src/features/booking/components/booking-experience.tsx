"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Clock3 } from "lucide-react";
import { intlLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { BookingConfirmationSheet } from "@/features/booking/components/booking-confirmation-sheet";
import { BookingWaitlistSheet } from "@/features/booking/components/booking-waitlist-sheet";
import {
  addDays,
  addMonth,
  type AvailabilityRow,
  type AvailabilityState,
  type CalendarBlockRow,
  type ConfirmationState,
  type CourtSlot,
  databaseDate,
  dateKey,
  defaultSchedule,
  type DragState,
  facilityMinutes,
  type FriendRow,
  formatSelectionTime,
  formatTime,
  hourHeight,
  minimumReservationMinutes,
  type ScheduleRuleRow,
  selectionStyle,
  selectionDateRange,
  startOfWeek,
  type TimeSelection,
  timeStringToMinutes,
  type WaitlistOpportunity,
} from "@/features/booking/lib/booking-calendar";
import { useLanguage } from "@/shared/preferences/language-provider";

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
  const [waitlistOpportunities, setWaitlistOpportunities] = useState<WaitlistOpportunity[]>([]);
  const [waitlistTarget, setWaitlistTarget] = useState<WaitlistOpportunity | null>(null);
  const [waitlistWorking, setWaitlistWorking] = useState(false);
  const [waitlistMessage, setWaitlistMessage] = useState("");
  const [scheduleRule, setScheduleRule] = useState<ScheduleRuleRow>(defaultSchedule);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("loading");
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [openCourt, setOpenCourt] = useState(false);
  const [occurrenceCount, setOccurrenceCount] = useState(1);
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>("idle");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [savedStatus, setSavedStatus] = useState<"pending" | "confirmed" | null>(null);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const dragFrame = useRef<number | null>(null);
  const pendingDragMinutes = useRef<number | null>(null);
  const openingMinutes = timeStringToMinutes(scheduleRule.opening_time, 16 * 60);
  const closingMinutes = timeStringToMinutes(scheduleRule.closing_time, 22 * 60);
  const courtIsOpen = scheduleRule.is_open && closingMinutes > openingMinutes;
  const snapMinutes = Math.max(1, scheduleRule.slot_duration_minutes || 30);
  const minimumSelectionMinutes = Math.ceil(minimumReservationMinutes / snapMinutes) * snapMinutes;
  const totalOpenMinutes = courtIsOpen ? closingMinutes - openingMinutes : 0;
  const calendarHeight = totalOpenMinutes / 60 * hourHeight;
  const timeLabelOffsets = useMemo(() => {
    if (!courtIsOpen) return [];
    const offsets = Array.from({ length: Math.floor(totalOpenMinutes / 60) + 1 }, (_, index) => index * 60);
    if (offsets.at(-1) !== totalOpenMinutes) offsets.push(totalOpenMinutes);
    return offsets;
  }, [courtIsOpen, totalOpenMinutes]);
  const gridLineOffsets = useMemo(() => courtIsOpen
    ? Array.from({ length: Math.ceil(totalOpenMinutes / 30) }, (_, index) => index * 30)
    : [], [courtIsOpen, totalOpenMinutes]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedTime) return;
    let active = true;
    // Both booking types invite named friends after a time has been selected.
    void createClient().rpc("list_friendships").then(({ data }) => {
      if (!active) return;
      setFriends(((data as FriendRow[] | null) ?? []).filter((item) => item.status === "accepted"));
      setFriendsLoading(false);
    });
    return () => { active = false; };
  }, [selectedTime]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    // Load all timeline inputs together so the player never sees mismatched availability.
    void Promise.all([
      supabase.rpc("get_available_slots", { p_date: databaseDate(focusDate) }),
      supabase.rpc("get_calendar_blocks", { p_date: databaseDate(focusDate) }),
      supabase.rpc("list_calendar_waitlist_opportunities", { p_date: databaseDate(focusDate) }),
      supabase
        .from("schedule_rules")
        .select("opening_time, closing_time, slot_duration_minutes, is_open")
        .eq("day_of_week", focusDate.getDay())
        .maybeSingle(),
    ]).then(([slotsResult, blocksResult, waitlistResult, scheduleResult]) => {
      if (!active) return;
      if (slotsResult.error || blocksResult.error || scheduleResult.error || !scheduleResult.data) {
        setAvailableStarts(new Set());
        setCalendarBlocks([]);
        setAvailabilityState("error");
        setCalendarMessage(t("booking.availabilityError"));
        return;
      }
      const nextSchedule = scheduleResult.data as ScheduleRuleRow;
      const nextOpeningMinutes = timeStringToMinutes(nextSchedule.opening_time, 16 * 60);
      const starts = new Set((slotsResult.data as AvailabilityRow[] | null)?.map((slot) => facilityMinutes(slot.start_at, nextOpeningMinutes)) ?? []);
      setScheduleRule(nextSchedule);
      setAvailableStarts(starts);
      setCalendarBlocks((blocksResult.data as CalendarBlockRow[] | null) ?? []);
      setWaitlistOpportunities(((waitlistResult.data as WaitlistOpportunity[] | null) ?? []).filter((item) => item.reservation_type === "open"));
      setAvailabilityState("ready");
    });

    return () => { active = false; };
  }, [availabilityVersion, focusDate, t]);

  const displayBlocks = useMemo(() => calendarBlocks.map((block, index) => ({
    id: `${block.block_type}-${block.start_at}-${index}`,
    kind: block.block_type,
    start: Math.max(0, facilityMinutes(block.start_at, openingMinutes)),
    end: Math.min(totalOpenMinutes, facilityMinutes(block.end_at, openingMinutes)),
    opportunity: block.block_type === "reserved" ? waitlistOpportunities.find((item) => item.start_at === block.start_at && item.end_at === block.end_at) ?? null : null,
  })).filter((block) => block.end > block.start), [calendarBlocks, openingMinutes, totalOpenMinutes, waitlistOpportunities]);
  const pastSlot = useMemo<CourtSlot | null>(() => {
    if (dateKey(focusDate) !== dateKey(today)) return null;
    const now = new Date(currentTime);
    const minutes = now.getHours() * 60 + now.getMinutes() - openingMinutes;
    const end = Math.min(totalOpenMinutes, Math.max(0, Math.ceil(minutes / snapMinutes) * snapMinutes));
    return end > 0 ? { id: "past", start: 0, end } : null;
  }, [currentTime, focusDate, openingMinutes, snapMinutes, today, totalOpenMinutes]);
  const rangeLabel = `${new Intl.DateTimeFormat(intlLocale(locale), { month: "long", day: "numeric" }).format(today)} – ${new Intl.DateTimeFormat(intlLocale(locale), { month: "long", day: "numeric" }).format(bookingLimit)}`;
  const selectedDateLabel = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", month: "long", day: "numeric" }).format(focusDate);
  const activeSelection = drag ?? selectedTime;
  const maximumRecurringCount = selectedTime
    ? Math.max(1, Math.min(4, Math.floor((bookingLimit.getTime() - selectedTime.date.getTime()) / (7 * 86_400_000)) + 1))
    : 1;

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
    setOccurrenceCount(1);
    setConfirmationState("idle");
    setConfirmationMessage("");
    setSelectedFriendIds([]);
  }

  function dismissConfirmation() {
    setSelectedTime(null);
    setOpenCourt(false);
    setOccurrenceCount(1);
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

    const { startAt, endAt } = selectionDateRange(selectedTime, openingMinutes);
    const { data: bookingIds, error } = occurrenceCount > 1
      ? await supabase.rpc("create_recurring_reservations", {
          p_start_at: startAt.toISOString(),
          p_end_at: endAt.toISOString(),
          p_type: openCourt ? "open" : "private",
          p_initial_player_count: 1,
          p_friend_ids: selectedFriendIds,
          p_occurrence_count: occurrenceCount,
        })
      : openCourt
        ? await supabase.rpc("create_open_reservation", {
          p_start_at: startAt.toISOString(),
          p_end_at: endAt.toISOString(),
          p_friend_ids: selectedFriendIds,
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

    // Read the committed status: invitation acceptance and court capacity decide it.
    const bookingId = Array.isArray(bookingIds) ? bookingIds[0] : bookingIds;
    const { data: savedBooking } = await supabase.from("reservations").select("status").eq("id", bookingId).single();
    const status = savedBooking?.status === "pending" ? "pending" : savedBooking?.status === "confirmed" ? "confirmed" : null;
    setSavedStatus(status);
    setConfirmationState("success");
    setConfirmationMessage(status === "pending" ? t(openCourt ? "lineup.pendingOpen" : "lineup.pendingPrivate") : status === "confirmed" ? (occurrenceCount > 1 ? t("booking.recurringSuccess", { count: occurrenceCount }) : t("booking.successMessage")) : t("booking.savedMessage"));
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

  async function updateWaitlist(join: boolean) {
    if (!waitlistTarget || waitlistTarget.reservation_type !== "open" || waitlistWorking) return;
    setWaitlistWorking(true);
    setWaitlistMessage("");
    const rpc = join ? "join_reservation_waitlist" : "leave_reservation_waitlist";
    const { error } = await createClient().rpc(rpc, { p_reservation_id: waitlistTarget.reservation_id });
    if (error) setWaitlistMessage(locale === "ar" ? t(join ? "waitlist.joinError" : "waitlist.leaveError") : error.message);
    else {
      setWaitlistMessage(t(join ? "waitlist.joined" : "waitlist.left"));
      setWaitlistTarget(null);
      setAvailabilityVersion((value) => value + 1);
    }
    setWaitlistWorking(false);
  }

  function pointToMinutes(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const rawMinutes = (event.clientY - bounds.top) / bounds.height * totalOpenMinutes;
    return Math.min(totalOpenMinutes, Math.max(0, Math.round(rawMinutes / snapMinutes) * snapMinutes));
  }

  function selectionFromPointer(anchorMinutes: number, currentMinutes: number): TimeSelection {
    const defaultEnd = anchorMinutes + minimumSelectionMinutes;
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
    if (availabilityState !== "ready" || !courtIsOpen) {
      setCalendarMessage(availabilityState === "loading" ? t("booking.loadingAvailability") : t("booking.availabilityUnavailable"));
      return;
    }
    const anchorMinutes = Math.max(0, Math.min(pointToMinutes(event), totalOpenMinutes - minimumSelectionMinutes));
    const initialSelection = { date: focusDate, startMinutes: anchorMinutes, endMinutes: anchorMinutes + minimumSelectionMinutes };
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
    // Limit pointer updates to one state change per animation frame for smooth dragging.
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
          <span>{availabilityState === "loading" ? t("common.loading") : !courtIsOpen ? t("booking.closedDay") : selectedTime ? `${formatSelectionTime(selectedTime.startMinutes, openingMinutes, locale)} – ${formatSelectionTime(selectedTime.endMinutes, openingMinutes, locale)}` : `${formatTime(openingMinutes, locale)} – ${formatTime(closingMinutes, locale)}`}</span>
        </div>
        {courtIsOpen ? <div className="booking-time-grid">
          <div className="booking-time-grid__gutter" style={{ height: calendarHeight }}>
            {timeLabelOffsets.map((offset) => <time key={offset} style={{ top: offset / 60 * hourHeight }}>{formatTime(openingMinutes + offset, locale)}</time>)}
          </div>
          <div
            aria-busy={availabilityState === "loading"}
            aria-label={t("booking.dayLabel", { date: selectedDateLabel, start: formatTime(openingMinutes, locale), end: formatTime(closingMinutes, locale) })}
            className="booking-time-grid__day"
            onPointerCancel={cancelDrag}
            onPointerDown={startDrag}
            onPointerMove={updateDrag}
            onPointerUp={finishDrag}
            style={{ height: calendarHeight }}
          >
            {gridLineOffsets.map((offset) => <i className={offset % 60 === 0 ? "booking-time-grid__hour-line" : "booking-time-grid__half-hour-line"} key={offset} style={{ top: offset / 60 * hourHeight }} />)}
            {pastSlot && <article className="booking-time-grid__event is-past" style={{ top: 0, height: pastSlot.end / 60 * hourHeight }}><strong>{t("booking.past")}</strong></article>}
            {displayBlocks.map((slot) => slot.opportunity ? (
              <button className={`booking-time-grid__event booking-time-grid__event--waitlist is-${slot.kind}`} key={slot.id} onClick={() => { setWaitlistMessage(""); setWaitlistTarget(slot.opportunity); }} onPointerDown={(event) => event.stopPropagation()} style={{ top: slot.start / 60 * hourHeight, height: (slot.end - slot.start) / 60 * hourHeight }} type="button">
                <strong>{t("booking.reserved")}</strong><span>{slot.opportunity.waitlist_status === "waiting" ? t("waitlist.position", { position: slot.opportunity.waitlist_position ?? 1 }) : t("waitlist.tapToJoin")}</span>
              </button>
            ) : (
              <article className={`booking-time-grid__event is-${slot.kind}`} key={slot.id} style={{ top: slot.start / 60 * hourHeight, height: (slot.end - slot.start) / 60 * hourHeight }}>
                <strong>{slot.kind === "reserved" ? t("booking.reserved") : t("booking.maintenance")}</strong><span>{formatSelectionTime(slot.start, openingMinutes, locale)}–{formatSelectionTime(slot.end, openingMinutes, locale)}</span>
              </article>
            ))}
            {activeSelection && (
              <div className={`booking-time-grid__selection${selectionIsInvalid ? " is-invalid" : ""}`} style={selectionStyle(activeSelection)}>
                <strong>{selectionIsInvalid ? t("booking.unavailable") : t("booking.selected")}</strong>
                <span>{formatSelectionTime(activeSelection.startMinutes, openingMinutes, locale)} – {formatSelectionTime(activeSelection.endMinutes, openingMinutes, locale)}</span>
              </div>
            )}
          </div>
        </div> : <div className="booking-time-grid__closed">{t("booking.closedDayMessage")}</div>}
        <p className="booking-time-section__status" aria-live="polite">{calendarMessage}</p>
      </section>

      {selectedTime ? (
        <BookingConfirmationSheet
          confirmationMessage={confirmationMessage}
          confirmationState={confirmationState}
          friends={friends}
          friendsLoading={friendsLoading}
          locale={locale}
          maximumRecurringCount={maximumRecurringCount}
          onClear={clearSelection}
          onConfirm={() => void confirmReservation()}
          savedStatus={savedStatus}
          onDismiss={dismissConfirmation}
          onSetOpenCourt={setOpenCourt}
          onSetOccurrenceCount={setOccurrenceCount}
          onToggleFriend={toggleFriend}
          openCourt={openCourt}
          openingMinutes={openingMinutes}
          occurrenceCount={occurrenceCount}
          selectedDateLabel={selectedDateLabel}
          selectedFriendIds={selectedFriendIds}
          selectedTime={selectedTime}
          selectionIsInvalid={selectionIsInvalid}
          t={t}
        />
      ) : null}

      {waitlistTarget ? (
        <BookingWaitlistSheet
          locale={locale}
          message={waitlistMessage}
          onClose={() => setWaitlistTarget(null)}
          onUpdate={(join) => void updateWaitlist(join)}
          selectedDateLabel={selectedDateLabel}
          t={t}
          target={waitlistTarget}
          working={waitlistWorking}
        />
      ) : null}

      <div className="booking-calendar__hours-note"><Clock3 aria-hidden="true" size={15} /> {courtIsOpen ? t("booking.openSelectedDay", { start: formatTime(openingMinutes, locale), end: formatTime(closingMinutes, locale) }) : t("booking.closedDayMessage")}</div>
    </section>
  );
}
