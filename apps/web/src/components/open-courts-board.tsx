"use client";

import { Check, ChevronRight, Clock3, LogOut, RefreshCw, UserRoundPlus, UsersRound, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
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
};

type JoinRequest = {
  join_request_id: string;
  reservation_id: string;
  player_username: string;
  start_at: string;
  end_at: string;
  requested_at: string;
};

export function OpenCourtsBoard() {
  const { locale, t } = useLanguage();
  const [courts, setCourts] = useState<OpenCourt[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime] = useState(() => Date.now());
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [courtResult, requestResult] = await Promise.all([
      supabase.rpc("list_open_courts"),
      supabase.rpc("list_open_court_requests"),
    ]);
    if (courtResult.error || requestResult.error) setMessage(t("openCourts.loadError"));
    else {
      setCourts((courtResult.data as OpenCourt[] | null) ?? []);
      setRequests((requestResult.data as JoinRequest[] | null) ?? []);
      setMessage("");
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
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

      <section className="open-court-section">
        <div className="open-court-section__heading"><div><span className="eyebrow">{t("openCourts.upcoming")}</span><h2>{t("openCourts.availableMatches")}</h2></div><button aria-label={t("openCourts.refresh")} className="open-court-refresh" onClick={() => void refresh()} type="button"><RefreshCw aria-hidden="true" size={17} /></button></div>
        {loading ? <div className="open-courts-empty"><Clock3 aria-hidden="true" /><p>{t("common.loading")}</p></div> : courts.length ? (
          <div className="open-court-grid">
            {courts.map((court) => {
              const canRequest = !court.is_host && (!court.request_status || ["rejected", "cancelled"].includes(court.request_status));
              return (
                <article className="open-match-card" key={court.reservation_id}>
                  <div className="open-match-card__top"><span className="open-match-card__date">{formatter.format(new Date(court.start_at))}</span><span className="status-chip"><UsersRound aria-hidden="true" size={14} />{t("openCourts.playersOfFour", { count: court.player_count })}</span></div>
                  <div>
                    <h3>{court.is_host ? t("openCourts.yourCourt") : <Link className="inline-player-link" href={`/players/${encodeURIComponent(court.host_username)}` as Route}>{t("openCourts.hostedBy", { username: court.host_username })}</Link>}</h3>
                    <p>{t("openCourts.spotsLeft", { count: court.available_spots })}</p>
                  </div>
                  <Link className="open-match-card__details" href={`/open-courts/${court.reservation_id}` as Route}>{t("openCourts.viewPlayers")}<ChevronRight aria-hidden="true" className="directional-icon" size={17} /></Link>
                  {court.is_host ? <span className="open-match-card__state">{t("openCourts.waitingForPlayers")}</span> : court.request_status === "pending" ? <span className="open-match-card__state">{t("openCourts.pendingApproval")}</span> : court.request_status === "accepted" ? <div className="open-match-card__joined"><span className="open-match-card__state is-accepted">{t("openCourts.joined")}</span><button className="open-court-leave" disabled={workingId === court.reservation_id || new Date(court.start_at).getTime() <= currentTime} onClick={() => void leaveCourt(court.reservation_id)} type="button"><LogOut aria-hidden="true" size={16} />{t("openCourts.leave")}</button></div> : <button className="button button--primary" disabled={!canRequest || workingId === court.reservation_id} onClick={() => void requestJoin(court.reservation_id)} type="button"><UserRoundPlus aria-hidden="true" size={17} />{t("openCourts.requestToJoin")}</button>}
                </article>
              );
            })}
          </div>
        ) : <div className="open-courts-empty"><UsersRound aria-hidden="true" /><h3>{t("openCourts.noneTitle")}</h3><p>{t("openCourts.noneText")}</p></div>}
      </section>
    </div>
  );
}
