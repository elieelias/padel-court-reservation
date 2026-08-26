import { ListOrdered, X } from "lucide-react";
import { facilityName } from "@/lib/config";
import { intlLocale, type Locale, type Translator } from "@/lib/i18n";
import { facilityTimeZone, type WaitlistOpportunity } from "@/features/booking/lib/booking-calendar";

type BookingWaitlistSheetProps = {
  locale: Locale;
  message: string;
  onClose: () => void;
  onUpdate: (join: boolean) => void;
  selectedDateLabel: string;
  t: Translator;
  target: WaitlistOpportunity;
  working: boolean;
};

export function BookingWaitlistSheet({ locale, message, onClose, onUpdate, selectedDateLabel, t, target, working }: BookingWaitlistSheetProps) {
  const alreadyWaiting = target.waitlist_status === "waiting";
  const time = new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit", timeZone: facilityTimeZone });

  return (
    <>
      <button aria-label={t("common.close")} className="sheet-backdrop booking-sheet-backdrop is-open" disabled={working} onClick={onClose} type="button" />
      <aside aria-labelledby="waitlist-heading" className="confirmation-sheet booking-confirmation-sheet booking-waitlist-sheet is-open">
        <div className="sheet-heading">
          <div><span className="eyebrow">{t("waitlist.eyebrow")}</span><h2 id="waitlist-heading">{alreadyWaiting ? t("waitlist.yourPlace") : t("waitlist.joinTitle")}</h2></div>
          <button aria-label={t("common.close")} className="sheet-close" disabled={working} onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button>
        </div>
        <div className="confirmation-detail">
          <div className="confirmation-detail__icon"><ListOrdered aria-hidden="true" size={23} /></div>
          <div><strong>{facilityName}</strong><span>{selectedDateLabel}</span><span>{time.format(new Date(target.start_at))} – {time.format(new Date(target.end_at))}</span></div>
        </div>
        <p className="booking-waitlist-sheet__description">{alreadyWaiting ? t("waitlist.positionDetail", { position: target.waitlist_position ?? 1 }) : t("waitlist.description")}</p>
        {message ? <p className="booking-confirmation-sheet__message" role="alert">{message}</p> : null}
        <button className="button button--primary confirmation-action" disabled={working} onClick={() => onUpdate(!alreadyWaiting)} type="button">
          {alreadyWaiting ? t("waitlist.leave") : t("waitlist.join")}
        </button>
        <button className="button booking-confirmation-sheet__cancel" disabled={working} onClick={onClose} type="button">{t("common.cancel")}</button>
      </aside>
    </>
  );
}
