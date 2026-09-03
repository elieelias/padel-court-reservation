import { CalendarDays, Check, CheckCircle2, Users, X } from "lucide-react";
import Link from "next/link";
import type { Locale, Translator } from "@/lib/i18n";
import { PostBookingActions } from "@/features/booking/components/post-booking-actions";
import { useFacilityBrand } from "@/shared/facility/facility-provider";
import {
  type ConfirmationState,
  type FriendRow,
  formatSelectionTime,
  selectionDateRange,
  type TimeSelection,
} from "@/features/booking/lib/booking-calendar";

type BookingConfirmationSheetProps = {
  savedStatus: "pending" | "confirmed" | null;
  confirmationMessage: string;
  confirmationState: ConfirmationState;
  friends: FriendRow[];
  friendsLoading: boolean;
  locale: Locale;
  maximumRecurringCount: number;
  onClear: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onSetOpenCourt: (open: boolean) => void;
  onSetOccurrenceCount: (count: number) => void;
  onToggleFriend: (playerId: string) => void;
  openCourt: boolean;
  openingMinutes: number;
  occurrenceCount: number;
  selectedDateLabel: string;
  selectedFriendIds: string[];
  selectedTime: TimeSelection;
  selectionIsInvalid: boolean;
  t: Translator;
};

/** The booking form is isolated from the calendar so each UI can evolve independently. */
export function BookingConfirmationSheet({
  savedStatus,
  confirmationMessage,
  confirmationState,
  friends,
  friendsLoading,
  locale,
  maximumRecurringCount,
  onClear,
  onConfirm,
  onDismiss,
  onSetOpenCourt,
  onSetOccurrenceCount,
  onToggleFriend,
  openCourt,
  openingMinutes,
  occurrenceCount,
  selectedDateLabel,
  selectedFriendIds,
  selectedTime,
  selectionIsInvalid,
  t,
}: BookingConfirmationSheetProps) {
  const { facilityName } = useFacilityBrand();
  const saving = confirmationState === "saving";
  const calendarRange = selectionDateRange(selectedTime, openingMinutes);

  return (
    <>
      <button className="sheet-backdrop booking-sheet-backdrop is-open" disabled={saving} type="button" aria-label={t("booking.closeConfirmation")} onClick={onDismiss} />
      <aside className="confirmation-sheet booking-confirmation-sheet is-open" aria-labelledby="confirm-booking-heading">
        <div className="sheet-handle" aria-hidden="true" />
        {confirmationState === "success" ? (
          <div className="booking-confirmation-success">
            <span className="booking-confirmation-success__icon"><CheckCircle2 aria-hidden="true" size={28} /></span>
            <div><h2 id="confirm-booking-heading">{t(savedStatus === "pending" ? "booking.pendingTitle" : savedStatus === "confirmed" ? "booking.successTitle" : "booking.savedTitle")}</h2><p>{confirmationMessage}</p></div>
            <ReservationSummary dateLabel={selectedDateLabel} facilityName={facilityName} locale={locale} occurrenceCount={occurrenceCount} openingMinutes={openingMinutes} selectedTime={selectedTime} t={t} />
            <PostBookingActions endAt={calendarRange.endAt} occurrenceCount={occurrenceCount} startAt={calendarRange.startAt} />
            <a className="button button--primary confirmation-action" href="/book#upcoming-reservations">{t("booking.viewReservation")}</a>
            <button className="button booking-confirmation-sheet__cancel" type="button" onClick={onClear}>{t("booking.done")}</button>
          </div>
        ) : (
          <>
            <div className="sheet-heading">
              <h2 id="confirm-booking-heading">{t("booking.confirmTitle")}</h2>
              <button className="sheet-close" disabled={saving} type="button" aria-label={t("common.close")} onClick={onDismiss}><X aria-hidden="true" size={20} /></button>
            </div>
            <ReservationSummary dateLabel={selectedDateLabel} facilityName={facilityName} locale={locale} occurrenceCount={occurrenceCount} openingMinutes={openingMinutes} selectedTime={selectedTime} t={t} />
            <label className="open-court-toggle">
              <span><strong>{t("booking.openCourt")}</strong><small>{t("booking.openCourtHelp")}</small></span>
              <input type="checkbox" checked={openCourt} disabled={saving} onChange={(event) => onSetOpenCourt(event.target.checked)} />
              <i aria-hidden="true" />
            </label>
            <div className="booking-repeat">
              <label className="open-court-toggle booking-repeat__toggle">
                <span><strong>{t("booking.repeatWeekly")}</strong><small>{t("booking.repeatWeeklyHelp")}</small></span>
                <input
                  checked={occurrenceCount > 1}
                  disabled={saving || maximumRecurringCount < 2}
                  onChange={(event) => onSetOccurrenceCount(event.target.checked ? 2 : 1)}
                  type="checkbox"
                />
                <i aria-hidden="true" />
              </label>
              {occurrenceCount > 1 ? (
                <div aria-label={t("booking.numberOfWeeks")} className="booking-repeat__options" role="group">
                  {[2, 3, 4].filter((count) => count <= maximumRecurringCount).map((count) => (
                    <button aria-pressed={occurrenceCount === count} className={occurrenceCount === count ? "is-selected" : ""} disabled={saving} key={count} onClick={() => onSetOccurrenceCount(count)} type="button">
                      {t("booking.weeklyBookings", { count })}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="booking-friend-picker">
                <div className="booking-friend-picker__heading"><span><Users aria-hidden="true" size={18} /><strong>{t("booking.addFriends")}</strong></span><small>{t("booking.invitedCount", { count: selectedFriendIds.length })}</small></div>
                <p>{t(openCourt ? "booking.openInviteHelp" : "booking.addFriendsHelp")}</p>
                {friendsLoading ? <span className="booking-friend-picker__empty">{t("common.loading")}</span> : friends.length ? (
                  <div className="booking-friend-picker__list">
                    {friends.map((friend) => {
                      const selected = selectedFriendIds.includes(friend.player_id);
                      return <button aria-pressed={selected} className={selected ? "is-selected" : ""} disabled={saving || (!selected && selectedFriendIds.length >= 3)} key={friend.player_id} onClick={() => onToggleFriend(friend.player_id)} type="button"><span>{friend.username.slice(0, 1).toUpperCase()}</span><strong>@{friend.username}</strong>{selected && <Check aria-hidden="true" size={17} />}</button>;
                    })}
                  </div>
                ) : <span className="booking-friend-picker__empty">{t("booking.noFriends")} <Link href="/profile/friends">{t("booking.addFriendsLink")}</Link></span>}
              </div>
            {(openCourt || selectedFriendIds.length > 0) && <p className="reservation-lineup__help">{t(openCourt ? "lineup.pendingOpen" : "lineup.pendingPrivate")}</p>}
            {confirmationState === "error" && <p className="booking-confirmation-sheet__message" role="alert">{confirmationMessage}</p>}
            <button className="button button--primary confirmation-action" disabled={saving || selectionIsInvalid} onClick={onConfirm} type="button">
              {saving ? t("booking.confirming") : t("booking.confirm")}
            </button>
            <button className="button booking-confirmation-sheet__cancel" disabled={saving} type="button" onClick={onDismiss}>{t("common.cancel")}</button>
          </>
        )}
      </aside>
    </>
  );
}

function ReservationSummary({ dateLabel, facilityName, locale, occurrenceCount, openingMinutes, selectedTime, t }: {
  dateLabel: string;
  facilityName: string;
  locale: Locale;
  occurrenceCount: number;
  openingMinutes: number;
  selectedTime: TimeSelection;
  t: Translator;
}) {
  return (
    <div className="confirmation-detail">
      <div className="confirmation-detail__icon"><CalendarDays aria-hidden="true" size={23} /></div>
      <div>
        <strong>{facilityName}</strong>
        <span>{dateLabel}</span>
        <span>{formatSelectionTime(selectedTime.startMinutes, openingMinutes, locale)} – {formatSelectionTime(selectedTime.endMinutes, openingMinutes, locale)}</span>
        {occurrenceCount > 1 ? <span>{t("booking.weeklyBookings", { count: occurrenceCount })}</span> : null}
      </div>
    </div>
  );
}
