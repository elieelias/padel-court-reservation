"use client";

import type { User } from "@supabase/supabase-js";
import { CalendarClock, History, LogOut, QrCode, UserRound, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useLanguage } from "@/shared/preferences/language-provider";
import { intlLocale, type Locale, type TranslationKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { CalendarActions } from "@/features/booking/components/calendar-actions";

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
  participants?: ReservationParticipant[];
  unregistered_player_count?: number;
};

export type ReservationParticipant = {
  username: string;
  role: "host" | "member";
};

type HistoryGrouping = "day" | "week" | "month";

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

function historyGroup(startAt: string, grouping: HistoryGrouping, locale: Locale) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Beirut",
    year: "numeric",
  }).formatToParts(new Date(startAt));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const language = intlLocale(locale);

  if (grouping === "month") {
    return {
      key: `${values.year}-${values.month}`,
      label: new Intl.DateTimeFormat(language, { month: "long", timeZone: "UTC", year: "numeric" }).format(date),
    };
  }

  if (grouping === "week") {
    const weekday = date.getUTCDay();
    const start = new Date(date);
    start.setUTCDate(date.getUTCDate() - ((weekday + 6) % 7));
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const formatter = new Intl.DateTimeFormat(language, { day: "numeric", month: "short", timeZone: "UTC" });
    return {
      key: start.toISOString().slice(0, 10),
      label: `${formatter.format(start)} – ${formatter.format(end)}`,
    };
  }

  return {
    key: `${values.year}-${values.month}-${values.day}`,
    label: new Intl.DateTimeFormat(language, { day: "numeric", month: "long", timeZone: "UTC", weekday: "long", year: "numeric" }).format(date),
  };
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
  const siteOrigin = useSyncExternalStore(subscribeToOrigin, readBrowserOrigin, readServerOrigin);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (!reservation.pass_token || !reservation.pass_code) return null;
  const qrValue = siteOrigin
    ? `${siteOrigin}/receipt/${reservation.pass_token}`
    : `padel-one:reservation:${reservation.pass_token}`;
  const participants = reservation.participants ?? [];
  const guestCount = reservation.unregistered_player_count ?? 0;

  return (
    <div className="reservation-pass-backdrop" onClick={onClose} role="presentation">
      <section aria-label={t("profile.reservationPass")} aria-modal="true" className="reservation-pass" onClick={(event) => event.stopPropagation()} role="dialog">
        <button aria-label={t("common.close")} className="reservation-pass__close" onClick={onClose} type="button"><X aria-hidden="true" size={22} /></button>
        <header className="reservation-pass__header">
          <div><span>{t("profile.reservationPass")}</span><strong>Padel One</strong></div>
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
        {participants.length || guestCount ? (
          <section className="reservation-pass__players">
            <div className="reservation-pass__players-heading">
              <strong>{t("profile.playersIncluded")}</strong>
              <span>{t("profile.playerTotal", { count: participants.length + guestCount })}</span>
            </div>
            <ul>
              {participants.map((participant) => (
                <li key={`${reservation.id}-${participant.username}`}>
                  <span className="reservation-pass__player-icon"><UserRound aria-hidden="true" size={15} /></span>
                  <strong>@{participant.username}</strong>
                  <small>{participant.role === "host" ? t("profile.hostPlayer") : t("profile.player")}</small>
                </li>
              ))}
              {guestCount > 0 ? (
                <li>
                  <span className="reservation-pass__player-icon"><UserRound aria-hidden="true" size={15} /></span>
                  <strong>{t("profile.guestPlayers", { count: guestCount })}</strong>
                  <small>{t("profile.unregistered")}</small>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
        <CalendarActions endAt={reservation.end_at} startAt={reservation.start_at} />
        <p>{t("profile.passInstruction")}</p>
      </section>
    </div>
  );
}

function subscribeToOrigin() {
  return () => undefined;
}

function readBrowserOrigin() {
  return window.location.origin;
}

function readServerOrigin() {
  return '';
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
  const { locale, t } = useLanguage();
  const [grouping, setGrouping] = useState<HistoryGrouping>("day");
  const visibleReservations = reservations.filter((reservation) => reservation.status !== "cancelled");
  const groups = useMemo(() => {
    const grouped = new Map<string, { label: string; reservations: ReservationRow[] }>();
    [...visibleReservations]
      .sort((first, second) => new Date(second.start_at).getTime() - new Date(first.start_at).getTime())
      .forEach((reservation) => {
        const group = historyGroup(reservation.start_at, grouping, locale);
        const current = grouped.get(group.key);
        if (current) current.reservations.push(reservation);
        else grouped.set(group.key, { label: group.label, reservations: [reservation] });
      });
    return [...grouped.values()];
  }, [grouping, locale, visibleReservations]);
  return (
    <section className="panel reservation-list-card profile-history-card">
      <div className="section-heading"><div><span className="eyebrow">{t("profile.historyEyebrow")}</span><h2>{t("profile.historyTitle")}</h2></div><History aria-hidden="true" size={25} /></div>
      {visibleReservations.length ? (
        <>
          <div aria-label={t("profile.groupHistory")} className="history-grouping" role="group">
            {(["day", "week", "month"] as const).map((option) => (
              <button aria-pressed={grouping === option} className={grouping === option ? "is-selected" : ""} key={option} onClick={() => setGrouping(option)} type="button">
                {t(`profile.group${option[0].toUpperCase()}${option.slice(1)}` as TranslationKey)}
              </button>
            ))}
          </div>
          <div className="reservation-history-groups">
            {groups.map((group) => (
              <section className="reservation-history-group" key={group.label}>
                <h3>{group.label}</h3>
                <div className="reservation-list">{group.reservations.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} showPayment />)}</div>
              </section>
            ))}
          </div>
        </>
      ) : <div className="empty-reservation"><strong>{t("profile.noHistory")}</strong><span>{t("profile.noHistoryText")}</span><Link className="text-link" href="/book">{t("profile.bookCourt")}</Link></div>}
    </section>
  );
}
