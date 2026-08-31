"use client";

import { CalendarClock, Check, ChevronRight, Clock3, ListOrdered, LogOut, RefreshCw, UserRoundPlus, UsersRound, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/shared/preferences/language-provider";
import { intlLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type OpenCourt = {
  reservation_id: string;
  host_username: string;
  start_at: string;
  end_at: string;
  player_count: number;
  available_spots: number;
  request_status: string | null;
  is_host: boolean;
  waitlist_status: string | null;
  waitlist_position: number | null;
};

type JoinRequest = {
  join_request_id: string;
  reservation_id: string;
  player_username: string;
  start_at: string;
  end_at: string;
  requested_at: string;
};

type PlayerWaitlist = {
  waitlist_id: string;
  reservation_id: string;
  reservation_type: "open" | "private";
  host_username: string;
  start_at: string;
  end_at: string;
  queue_position: number;
  player_count: number;
  available_spots: number;
};

export function OpenCourtsBoard({ cancellationHours = 2 }: { cancellationHours?: number }) {
  const { locale, t } = useLanguage();
  const [courts, setCourts] = useState<OpenCourt[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [waitlists, setWaitlists] = useState<PlayerWaitlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [courtResult, requestResult, waitlistResult] = await Promise.all([
      supabase.rpc("list_open_courts"),
      supabase.rpc("list_open_court_requests"),
      supabase.rpc("list_my_waitlists"),
    ]);
    if (courtResult.error || requestResult.error || waitlistResult.error) setMessage(t("openCourts.loadError"));
    else {
      setCourts((courtResult.data as OpenCourt[] | null) ?? []);
      setRequests((requestResult.data as JoinRequest[] | null) ?? []);
      setWaitlists((waitlistResult.data as PlayerWaitlist[] | null) ?? []);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => { window.clearTimeout(timeout); window.clearInterval(timer); };
  }, [refresh]);

  const formatter = useMemo(() => new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), [locale]);

  async function requestJoin(reservationId: string) {
    setWorkingId(reservationId);
    const { error } = await createClient().rpc("request_open_court_join", { p_reservation_id: reservationId });
    setMessage(error ? (locale === "ar" ? t("openCourts.requestError") : error.message) : t("openCourts.requestSent"));
    await refresh();
    setWorkingId(null);
  }

  async function respond(requestId: string, accept: boolean) {
    setWorkingId(requestId);
    const { error } = await createClient().rpc("respond_open_court_join", { p_join_request_id: requestId, p_accept: accept });
    setMessage(error ? (locale === "ar" ? t("openCourts.respondError") : error.message) : accept ? t("openCourts.accepted") : t("openCourts.declined"));
    await refresh();
    setWorkingId(null);
  }

  async function leaveCourt(reservationId: string) {
    if (!window.confirm(t("openCourts.leavePrompt"))) return;
    setWorkingId(reservationId);
    const { error } = await createClient().rpc("leave_open_court", { p_reservation_id: reservationId });
    setMessage(error ? (locale === "ar" ? t("openCourts.leaveError") : error.message) : t("openCourts.left"));
    await refresh();
    setWorkingId(null);
  }

  async function joinWaitlist(reservationId: string) {
    setWorkingId(reservationId);
    const { error } = await createClient().rpc("join_reservation_waitlist", { p_reservation_id: reservationId });
    setMessage(error ? (locale === "ar" ? t("waitlist.joinError") : error.message) : t("waitlist.joined"));
    await refresh();
    setWorkingId(null);
  }

  async function leaveWaitlist(reservationId: string) {
    setWorkingId(reservationId);
    const { error } = await createClient().rpc("leave_reservation_waitlist", { p_reservation_id: reservationId });
    setMessage(error ? (locale === "ar" ? t("waitlist.leaveError") : error.message) : t("waitlist.left"));
    await refresh();
    setWorkingId(null);
  }

  return (
    <div className="open-courts-board">
      {message && <p className="open-courts-message" role="status">{message}</p>}
      {requests.length > 0 && (
        <section className="open-court-section">
          <div className="open-court-section__heading"><div><span className="eyebrow">{t("openCourts.hostEyebrow")}</span><h2>{t("openCourts.joinRequests")}</h2></div><span>{requests.length}</span></div>
          <div className="open-court-request-list">
            {requests.map((request) => (
              <article className="open-court-request" key={request.join_request_id}>
                <Link className="friend-profile-link" href={`/players/${encodeURIComponent(request.player_username)}` as Route}>
                  <span className="friend-avatar">{request.player_username.slice(0, 1).toUpperCase()}</span>
                  <span><strong>@{request.player_username}</strong><small>{formatter.format(new Date(request.start_at))}</small></span>
                </Link>
                <div className="friend-row__actions">
                  <button aria-label={t("openCourts.acceptRequest")} className="friend-icon-button is-accept" disabled={workingId === request.join_request_id} onClick={() => void respond(request.join_request_id, true)} type="button"><Check aria-hidden="true" size={18} /></button>
                  <button aria-label={t("openCourts.declineRequest")} className="friend-icon-button" disabled={workingId === request.join_request_id} onClick={() => void respond(request.join_request_id, false)} type="button"><X aria-hidden="true" size={18} /></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {waitlists.length > 0 && (
        <section className="open-court-section player-waitlist" id="my-waitlist">
          <div className="open-court-section__heading">
            <div><span className="eyebrow">{t("waitlist.eyebrow")}</span><h2>{t("waitlist.myWaitlist")}</h2></div>
            <span>{waitlists.length}</span>
          </div>
          <p className="player-waitlist__intro">{t("waitlist.myWaitlistDescription")}</p>
          <div className="player-waitlist__list">
            {waitlists.map((entry) => (
              <article className="player-waitlist-card" key={entry.waitlist_id}>
                <span aria-label={t("waitlist.queuePosition", { position: entry.queue_position })} className="player-waitlist-card__position"><small>{t("waitlist.queue")}</small><strong>{entry.queue_position}</strong></span>
                <div className="player-waitlist-card__body">
                  <span><CalendarClock aria-hidden="true" size={15} />{formatter.format(new Date(entry.start_at))}</span>
                  <h3>{entry.reservation_type === "open" ? t("waitlist.openCourt") : t("waitlist.reservedCourt")}</h3>
                  <Link className="inline-player-link" href={`/players/${encodeURIComponent(entry.host_username)}` as Route}>{t("openCourts.hostedBy", { username: entry.host_username })}</Link>
                </div>
                <div className="player-waitlist-card__actions">
                  {entry.reservation_type === "open" && <Link className="player-waitlist-card__details" href={`/open-courts/${entry.reservation_id}` as Route}>{t("waitlist.viewCourt")}<ChevronRight aria-hidden="true" className="directional-icon" size={16} /></Link>}
                  <button disabled={workingId === entry.reservation_id} onClick={() => void leaveWaitlist(entry.reservation_id)} type="button">{t("waitlist.leave")}</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="open-court-section">
        <div className="open-court-section__heading"><div><span className="eyebrow">{t("openCourts.upcoming")}</span><h2>{t("openCourts.availableMatches")}</h2></div><button aria-label={t("openCourts.refresh")} className="open-court-refresh" onClick={() => void refresh()} type="button"><RefreshCw aria-hidden="true" size={17} /></button></div>
        {loading ? <div className="open-courts-empty"><Clock3 aria-hidden="true" /><p>{t("common.loading")}</p></div> : courts.length ? (
          <div className="open-court-grid">
            {courts.map((court) => {
              const canRequest = court.available_spots > 0 && !court.is_host && (!court.request_status || ["rejected", "cancelled"].includes(court.request_status));
              const isWaitlisted = court.waitlist_status === "waiting";
              return (
                <article className="open-match-card" key={court.reservation_id}>
                  <div className="open-match-card__top"><span className="open-match-card__date">{formatter.format(new Date(court.start_at))}</span><span className="status-chip"><UsersRound aria-hidden="true" size={14} />{t("openCourts.playersOfFour", { count: court.player_count })}</span></div>
                  <div>
                    <span className={`reservation-status reservation-status--${court.player_count === 4 ? "confirmed" : "pending"}`}>{t(court.player_count === 4 ? "status.confirmed" : "status.pending")}</span>
                    {4 - court.player_count - court.available_spots > 0 && <small>{t("openCourts.heldPlaces", { count: 4 - court.player_count - court.available_spots })}</small>}
                    <h3>{court.is_host ? t("openCourts.yourCourt") : <Link className="inline-player-link" href={`/players/${encodeURIComponent(court.host_username)}` as Route}>{t("openCourts.hostedBy", { username: court.host_username })}</Link>}</h3>
                    <p>{court.available_spots > 0 ? t("openCourts.spotsLeft", { count: court.available_spots }) : t(court.player_count === 4 ? "openCourts.full" : "openCourts.allHeld")}</p>
                  </div>
                  <Link className="open-match-card__details" href={`/open-courts/${court.reservation_id}` as Route}>{t("openCourts.viewPlayers")}<ChevronRight aria-hidden="true" className="directional-icon" size={17} /></Link>
                  {court.is_host ? <span className="open-match-card__state">{court.available_spots > 0 ? t("openCourts.waitingForPlayers") : t("openCourts.full")}</span> : court.request_status === "invited" ? <Link className="button button--primary" href="/book#reservation-invitations">{t("openCourts.invited")}</Link> : court.request_status === "pending" ? <span className="open-match-card__state">{t("openCourts.pendingApproval")}</span> : court.request_status === "accepted" ? <div className="open-match-card__joined"><span className="open-match-card__state is-accepted">{t("openCourts.joined")}</span><button className="open-court-leave" disabled={workingId === court.reservation_id || new Date(court.start_at).getTime() - currentTime <= cancellationHours * 3_600_000} onClick={() => void leaveCourt(court.reservation_id)} type="button"><LogOut aria-hidden="true" size={16} />{t("openCourts.leave")}</button></div> : isWaitlisted ? <div className="open-match-card__joined"><span className="open-match-card__state is-waitlisted"><ListOrdered aria-hidden="true" size={15} />{t("waitlist.position", { position: court.waitlist_position ?? 1 })}</span><button className="open-court-leave" disabled={workingId === court.reservation_id} onClick={() => void leaveWaitlist(court.reservation_id)} type="button">{t("waitlist.leave")}</button></div> : court.available_spots === 0 ? <button className="button button--primary" disabled={workingId === court.reservation_id} onClick={() => void joinWaitlist(court.reservation_id)} type="button"><ListOrdered aria-hidden="true" size={17} />{t("waitlist.join")}</button> : <button className="button button--primary" disabled={!canRequest || workingId === court.reservation_id} onClick={() => void requestJoin(court.reservation_id)} type="button"><UserRoundPlus aria-hidden="true" size={17} />{t("openCourts.requestToJoin")}</button>}
                </article>
              );
            })}
          </div>
        ) : <div className="open-courts-empty"><UsersRound aria-hidden="true" /><h3>{t("openCourts.noneTitle")}</h3><p>{t("openCourts.noneText")}</p></div>}
      </section>
    </div>
  );
}
