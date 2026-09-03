"use client";

import type { User } from "@supabase/supabase-js";
import { CalendarClock, History, QrCode, UserRound, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useFacilityBrand } from "@/shared/facility/facility-provider";
import { useLanguage } from "@/shared/preferences/language-provider";
import { intlLocale, type Locale, type TranslationKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { ReservationLineup } from "@/features/booking/components/reservation-lineup";
import { PostBookingActions } from "@/features/booking/components/post-booking-actions";
import { reservationReceiptUrl } from "@/features/booking/lib/receipt-link";

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
      {reservation.status === "pending" && <p className="reservation-lineup__help">{t(reservation.type === "open" ? "lineup.pendingOpen" : "lineup.pendingPrivate")}</p>}
      {action}
    </article>
  );
}

function ReservationPass({ playerName, reservation, onClose }: { playerName: string; reservation: ReservationRow; onClose: () => void }) {
  const { locale, t } = useLanguage();
  const { facilityName } = useFacilityBrand();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // The browser's top layer avoids clipping by transformed page containers,
    // traps keyboard focus, and restores focus to the receipt button on close.
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!reservation.pass_token || !reservation.pass_code) return null;
  const qrValue = reservationReceiptUrl(reservation.pass_token);
  const participants = reservation.participants ?? [];
  const guestCount = reservation.unregistered_player_count ?? 0;

  return (
    <dialog aria-label={t("profile.reservationPass")} className="reservation-pass-backdrop" ref={dialogRef} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="reservation-pass">
        <header className="reservation-pass__header">
          <div><span>{t("profile.reservationPass")}</span><strong>{facilityName}</strong></div>
          <button aria-label={t("common.close")} className="reservation-pass__close" onClick={onClose} type="button"><X aria-hidden="true" size={22} /></button>
        </header>
        <div className="reservation-pass__body">
        <div className="reservation-pass__identity"><span>{t("profile.player")}</span><strong>{playerName}</strong></div>
        <div className="reservation-pass__qr" aria-label={t("profile.qrCode")}>
          <QRCodeSVG bgColor="#f4f7fa" fgColor="#26313b" level="M" marginSize={2} size={190} value={qrValue} />
        </div>
        <div className="reservation-pass__code"><span>{t("profile.backupCode")}</span><strong>{reservation.pass_code}</strong></div>
        <dl className="reservation-pass__details">
          <div><dt>{t("profile.bookingStatus")}</dt><dd>{t(`status.${reservation.status}` as TranslationKey)}</dd></div>
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
        <PostBookingActions endAt={reservation.end_at} showShare={false} startAt={reservation.start_at} />
        <p>{t("profile.passInstruction")}</p>
        </div>
        <footer className="reservation-pass__footer">
          <button className="button button--primary" onClick={onClose} type="button">{t("booking.done")}</button>
        </footer>
      </section>
    </dialog>
  );
}

export function UpcomingReservations({ initialReservations, initialUser, cancellationHours, playerName }: { initialReservations: ReservationRow[]; initialUser: User | null; cancellationHours: number; playerName: string }) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  // Server refreshes must replace stale statuses and lineups after an invitation response.
  const reservations = initialReservations.filter((reservation) => !hiddenIds.includes(reservation.id));
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [passId, setPassId] = useState<string | null>(null);
  const passReservation = reservations.find((reservation) => reservation.id === passId);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = () => { setCurrentTime(Date.now()); router.refresh(); };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [router]);

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
    setHiddenIds((ids) => [...ids, reservation.id]);
    setMessage(t("profile.cancelled"));
    router.refresh();
  }


  return (
    <section className="panel reservation-list-card book-upcoming-reservations" id="upcoming-reservations">
      <div className="section-heading"><div><span className="eyebrow">{t("profile.upcomingEyebrow")}</span><h2>{t("profile.upcomingTitle")}</h2></div><CalendarClock aria-hidden="true" size={25} /></div>
      {message && <p className="profile-message" role="status">{message}</p>}
      {reservations.length ? <div className="reservation-list">{reservations.map((reservation) => <ReservationCard action={<div className="reservation-item__actions">{reservation.pass_token && reservation.pass_code ? <button className="reservation-pass-button" onClick={() => setPassId(reservation.id)} type="button"><QrCode aria-hidden="true" size={17} />{t("profile.showPass")}</button> : null}{canCancel(reservation) ? <button className="reservation-cancel" disabled={cancellingId === reservation.id} onClick={() => void cancelReservation(reservation)} type="button">{cancellingId === reservation.id ? t("profile.cancelling") : t("profile.cancelReservation")}</button> : null}{initialUser && <ReservationLineup reservationId={reservation.id} userId={initialUser.id} onLeft={() => setHiddenIds((ids) => [...ids, reservation.id])} />}</div>} key={reservation.id} reservation={reservation} />)}</div> : <div className="empty-reservation"><strong>{t("profile.noUpcoming")}</strong><span>{t("profile.noUpcomingText")}</span></div>}
      {passReservation ? <ReservationPass onClose={() => setPassId(null)} playerName={playerName} reservation={passReservation} /> : null}
    </section>
  );
}

export function ReservationHistory({ reservations, loadError = false }: { reservations: ReservationRow[]; loadError?: boolean }) {
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
      {loadError ? <p className="profile-message profile-message--error" role="alert">{t("profile.historyLoadError")}</p> : null}
      {!loadError && visibleReservations.length ? (
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
      ) : !loadError ? <div className="empty-reservation"><strong>{t("profile.noHistory")}</strong><span>{t("profile.noHistoryText")}</span><Link className="text-link" href="/book">{t("profile.bookCourt")}</Link></div> : null}
    </section>
  );
}
