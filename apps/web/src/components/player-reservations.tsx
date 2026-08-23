"use client";

import type { User } from "@supabase/supabase-js";
import { CalendarClock, History, LogOut, QrCode, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useLanguage } from "@/components/language-provider";
import { intlLocale, type Locale, type TranslationKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

export type ReservationRow = {
  id: string;
  host_id: string;
  start_at: string;
  end_at: string;
  type: "private" | "open";
  status: "pending" | "confirmed" | "completed" | "cancelled" | "expired";
  price: number | string;
  payment_status: "unpaid" | "paid";
  pass_token?: string | null;
  pass_code?: string | null;
};

function reservationDate(startAt: string, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Beirut" }).format(new Date(startAt));
}

function reservationTime(startAt: string, endAt: string, locale: Locale) {
  const formatter = new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit", timeZone: "Asia/Beirut" });
  return `${formatter.format(new Date(startAt))} – ${formatter.format(new Date(endAt))}`;
}

function priceLabel(value: number | string, locale: Locale) {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "USD" }).format(Number(value));
}

function ReservationCard({ reservation, showPayment = false, action }: { reservation: ReservationRow; showPayment?: boolean; action?: React.ReactNode }) {
  const { locale, t } = useLanguage();
  return (
    <article className="reservation-item">
      <div className="reservation-item__date"><strong>{reservationDate(reservation.start_at, locale)}</strong><span>{reservationTime(reservation.start_at, reservation.end_at, locale)}</span></div>
      <div className="reservation-item__chips">
        <span className={`reservation-status reservation-status--${reservation.status}`}>{t(`status.${reservation.status}` as TranslationKey)}</span>
        {showPayment && <span className={`payment-status payment-status--${reservation.payment_status}`}><WalletCards aria-hidden="true" size={14} /> {t("profile.cash", { status: t(`status.${reservation.payment_status}` as TranslationKey) })}</span>}
      </div>
      <dl className="reservation-item__details">
        <div><dt>{t("profile.reservation")}</dt><dd>{reservation.type === "open" ? t("booking.openCourt") : t("profile.privateCourt")}</dd></div>
        <div><dt>{t("profile.price")}</dt><dd>{priceLabel(reservation.price, locale)}</dd></div>
      </dl>
      {action}
    </article>
  );
}

function ReservationPass({ playerName, reservation, onClose }: { playerName: string; reservation: ReservationRow; onClose: () => void }) {
  const { locale, t } = useLanguage();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (!reservation.pass_token || !reservation.pass_code) return null;
  const qrValue = `padel-one:reservation:${reservation.pass_token}`;

  return (
    <div className="reservation-pass-backdrop" onClick={onClose} role="presentation">
      <section aria-label={t("profile.reservationPass")} aria-modal="true" className="reservation-pass" onClick={(event) => event.stopPropagation()} role="dialog">
        <header className="reservation-pass__header">
          <div><span>{t("profile.reservationPass")}</span><strong>Padel One</strong></div>
          <button aria-label={t("common.close")} onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button>
        </header>
        <div className="reservation-pass__identity"><span>{t("profile.player")}</span><strong>{playerName}</strong></div>
        <div className="reservation-pass__qr" aria-label={t("profile.qrCode")}>
          <QRCodeSVG bgColor="#f4f7fa" fgColor="#26313b" level="M" marginSize={2} size={190} value={qrValue} />
        </div>
        <div className="reservation-pass__code"><span>{t("profile.backupCode")}</span><strong>{reservation.pass_code}</strong></div>
        <dl className="reservation-pass__details">
          <div><dt>{t("profile.date")}</dt><dd>{reservationDate(reservation.start_at, locale)}</dd></div>
          <div><dt>{t("profile.time")}</dt><dd>{reservationTime(reservation.start_at, reservation.end_at, locale)}</dd></div>
          <div><dt>{t("profile.reservation")}</dt><dd>{reservation.type === "open" ? t("booking.openCourt") : t("profile.privateCourt")}</dd></div>
          <div><dt>{t("profile.price")}</dt><dd>{priceLabel(reservation.price, locale)}</dd></div>
          <div>
            <dt>{t("profile.paymentStatus")}</dt>
            <dd><span className={`receipt-payment-status receipt-payment-status--${reservation.payment_status}`}>{t(`status.${reservation.payment_status}` as TranslationKey)}</span></dd>
          </div>
        </dl>
        <p>{t("profile.passInstruction")}</p>
      </section>
    </div>
  );
}

export function UpcomingReservations({ initialReservations, initialUser, cancellationHours, playerName }: { initialReservations: ReservationRow[]; initialUser: User | null; cancellationHours: number; playerName: string }) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [reservations, setReservations] = useState(initialReservations);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [passReservation, setPassReservation] = useState<ReservationRow | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function canCancel(reservation: ReservationRow) {
    return Boolean(initialUser && reservation.host_id === initialUser.id && new Date(reservation.start_at).getTime() - currentTime > cancellationHours * 3_600_000);
  }

  async function cancelReservation(reservation: ReservationRow) {
    if (cancellingId || !window.confirm(t("profile.cancelPrompt"))) return;
    setCancellingId(reservation.id);
    setMessage("");
    const { error } = await createClient().rpc("cancel_reservation", { p_reservation_id: reservation.id });
    setCancellingId(null);
    if (error) {
      setMessage(locale === "ar" ? t("profile.cancelError") : error.message || t("profile.cancelError"));
      return;
    }
    setReservations((items) => items.filter((item) => item.id !== reservation.id));
    setMessage(t("profile.cancelled"));
    router.refresh();
  }

  async function leaveOpenCourt(reservation: ReservationRow) {
    if (leavingId || !window.confirm(t("openCourts.leavePrompt"))) return;
    setLeavingId(reservation.id);
    setMessage("");
    const { error } = await createClient().rpc("leave_open_court", { p_reservation_id: reservation.id });
    setLeavingId(null);
    if (error) {
      setMessage(locale === "ar" ? t("openCourts.leaveError") : error.message || t("openCourts.leaveError"));
      return;
    }
    setReservations((items) => items.filter((item) => item.id !== reservation.id));
    setMessage(t("openCourts.left"));
    router.refresh();
  }

  return (
    <section className="panel reservation-list-card book-upcoming-reservations" id="upcoming-reservations">
      <div className="section-heading"><div><span className="eyebrow">{t("profile.upcomingEyebrow")}</span><h2>{t("profile.upcomingTitle")}</h2></div><CalendarClock aria-hidden="true" size={25} /></div>
      {message && <p className="profile-message" role="status">{message}</p>}
      {reservations.length ? <div className="reservation-list">{reservations.map((reservation) => <ReservationCard action={<div className="reservation-item__actions">{reservation.pass_token && reservation.pass_code ? <button className="reservation-pass-button" onClick={() => setPassReservation(reservation)} type="button"><QrCode aria-hidden="true" size={17} />{t("profile.showPass")}</button> : null}{canCancel(reservation) ? <button className="reservation-cancel" disabled={cancellingId === reservation.id} onClick={() => void cancelReservation(reservation)} type="button">{cancellingId === reservation.id ? t("profile.cancelling") : t("profile.cancelReservation")}</button> : null}{initialUser && reservation.type === "open" && reservation.host_id !== initialUser.id && new Date(reservation.start_at).getTime() > currentTime ? <button className="reservation-leave" disabled={leavingId === reservation.id} onClick={() => void leaveOpenCourt(reservation)} type="button"><LogOut aria-hidden="true" size={16} />{leavingId === reservation.id ? t("openCourts.leaving") : t("openCourts.leave")}</button> : null}</div>} key={reservation.id} reservation={reservation} />)}</div> : <div className="empty-reservation"><strong>{t("profile.noUpcoming")}</strong><span>{t("profile.noUpcomingText")}</span></div>}
      {passReservation ? <ReservationPass onClose={() => setPassReservation(null)} playerName={playerName} reservation={passReservation} /> : null}
    </section>
  );
}

export function ReservationHistory({ reservations }: { reservations: ReservationRow[] }) {
  const { t } = useLanguage();
  const visibleReservations = reservations.filter((reservation) => reservation.status !== "cancelled");
  return (
    <section className="panel reservation-list-card profile-history-card">
      <div className="section-heading"><div><span className="eyebrow">{t("profile.historyEyebrow")}</span><h2>{t("profile.historyTitle")}</h2></div><History aria-hidden="true" size={25} /></div>
      {visibleReservations.length ? <div className="reservation-list">{visibleReservations.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} showPayment />)}</div> : <div className="empty-reservation"><strong>{t("profile.noHistory")}</strong><span>{t("profile.noHistoryText")}</span><Link className="text-link" href="/book">{t("profile.bookCourt")}</Link></div>}
    </section>
  );
}
