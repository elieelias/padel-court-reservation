"use client";

import { CalendarPlus, Download } from "lucide-react";
import { useLanguage } from "@/shared/preferences/language-provider";
import { appleCalendarFile, type CalendarReservation, googleCalendarUrl } from "@/features/booking/lib/calendar-links";

export function CalendarActions(reservation: CalendarReservation) {
  const { t } = useLanguage();

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

  return (
    <section aria-label={t("calendar.addToCalendar")} className="calendar-actions">
      <strong>{t("calendar.addToCalendar")}</strong>
      <div>
        <a className="calendar-action" href={googleCalendarUrl(reservation)} rel="noreferrer" target="_blank">
          <CalendarPlus aria-hidden="true" size={17} />{t("calendar.google")}
        </a>
        <button className="calendar-action" onClick={downloadAppleCalendar} type="button">
          <Download aria-hidden="true" size={17} />{t("calendar.apple")}
        </button>
      </div>
    </section>
  );
}
