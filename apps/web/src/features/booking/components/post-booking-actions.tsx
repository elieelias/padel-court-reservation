"use client";

import { CalendarPlus, Download, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { appName, facilityName, siteUrl } from "@/lib/config";
import { intlLocale } from "@/lib/i18n";
import { useLanguage } from "@/shared/preferences/language-provider";
import { appleCalendarFile, type CalendarReservation, googleCalendarUrl } from "@/features/booking/lib/calendar-links";
import { shareReservationDetails } from "@/features/booking/lib/reservation-sharing";

/** Groups the useful next steps that remain available after a booking. */
export function PostBookingActions(reservation: CalendarReservation) {
  const { locale, t } = useLanguage();
  const [shareMessage, setShareMessage] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareInProgress = useRef(false);

  const shareText = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(intlLocale(locale), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Beirut",
    });
    const schedule = formatter.formatRange(new Date(reservation.startAt), new Date(reservation.endAt));
    const repetition = (reservation.occurrenceCount ?? 1) > 1
      ? ` · ${t("booking.weeklyBookings", { count: reservation.occurrenceCount ?? 1 })}`
      : "";
    return t("booking.shareText", { facility: facilityName, schedule, repetition });
  }, [locale, reservation.endAt, reservation.occurrenceCount, reservation.startAt, t]);

  useEffect(() => {
    if (!shareMessage) return;
    const timeout = window.setTimeout(() => setShareMessage(""), 3_000);
    return () => window.clearTimeout(timeout);
  }, [shareMessage]);

  function downloadAppleCalendar() {
    const file = new Blob([appleCalendarFile(reservation)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "padel-one-reservation.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  async function shareReservation() {
    if (shareInProgress.current) return;
    shareInProgress.current = true;
    setSharing(true);
    setShareMessage("");
    setManualCopy(false);
    try {
      // Share the public app address, never a receipt's check-in token or a
      // private account URL. Sharing details is not an invitation to join.
      const result = await shareReservationDetails(
        { title: `${appName} · ${facilityName}`, text: shareText, url: siteUrl },
        {
          share: navigator.share ? (data) => navigator.share(data) : undefined,
          copy: navigator.clipboard ? (text) => navigator.clipboard.writeText(text) : undefined,
        },
      );
      if (result === "shared") setShareMessage(t("booking.shared"));
      if (result === "copied") setShareMessage(t("booking.shareCopied"));
      if (result === "manual") setManualCopy(true);
    } finally {
      shareInProgress.current = false;
      setSharing(false);
    }
  }

  return (
    <section aria-label={t("booking.afterBooking")} className="post-booking-actions">
      <strong>{t("booking.afterBooking")}</strong>
      <div className="post-booking-actions__grid">
        <a className="post-booking-action" href={googleCalendarUrl(reservation)} rel="noreferrer" target="_blank">
          <CalendarPlus aria-hidden="true" size={17} />{t("calendar.google")}
        </a>
        <button className="post-booking-action" onClick={downloadAppleCalendar} type="button">
          <Download aria-hidden="true" size={17} />{t("calendar.apple")}
        </button>
        <button className="post-booking-action post-booking-action--share" disabled={sharing} onClick={() => void shareReservation()} type="button">
          <Share2 aria-hidden="true" size={17} />{t("booking.shareReservation")}
        </button>
      </div>
      {shareMessage ? <span className="post-booking-actions__message" role="status">{shareMessage}</span> : null}
      {manualCopy ? (
        <label className="post-booking-actions__copy">
          <span>{t("booking.shareManualCopy")}</span>
          <textarea onFocus={(event) => event.currentTarget.select()} readOnly rows={4} value={`${shareText}\n${siteUrl}`} />
        </label>
      ) : null}
    </section>
  );
}
