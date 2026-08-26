"use client";

import { Check, Clock3, RefreshCw, UserRound, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/shared/preferences/language-provider";
import { intlLocale, type TranslationKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type InvitationRow = {
  invitation_id: string;
  reservation_id: string;
  host_username: string;
  invitee_username: string;
  start_at: string;
  end_at: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  is_host: boolean;
  created_at: string;
};

export function ReservationInvitations() {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const { data, error } = await createClient().rpc("list_private_reservation_invitations");
    setInvitations((data as InvitationRow[] | null) ?? []);
    setMessage(error ? t("invitations.loadError") : "");
    setLoading(false);
  }, [t]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const incoming = invitations.filter((invitation) => !invitation.is_host && invitation.status === "pending");
  const hosted = useMemo(() => {
    const groups = new Map<string, InvitationRow[]>();
    invitations.filter((invitation) => invitation.is_host).forEach((invitation) => {
      groups.set(invitation.reservation_id, [...(groups.get(invitation.reservation_id) ?? []), invitation]);
    });
    return [...groups.values()];
  }, [invitations]);
  const dateTime = useMemo(() => new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric", hour: "numeric", minute: "2-digit", month: "short", timeZone: "Asia/Beirut", weekday: "short",
  }), [locale]);

  async function respond(invitationId: string, accept: boolean) {
    setWorkingId(invitationId);
    const { error } = await createClient().rpc("respond_reservation_invitation", { p_invitation_id: invitationId, p_accept: accept });
    setMessage(error ? (locale === "ar" ? t("invitations.respondError") : error.message) : accept ? t("invitations.accepted") : t("invitations.declined"));
    await refresh();
    setWorkingId(null);
    router.refresh();
  }

  if (!loading && !message && !incoming.length && !hosted.length) return null;

  return (
    <section className="panel reservation-invitations" id="reservation-invitations">
      <div className="section-heading">
        <div><span className="eyebrow">{t("invitations.eyebrow")}</span><h2>{t("invitations.title")}</h2></div>
        <button aria-label={t("invitations.refresh")} className="open-court-refresh" onClick={() => void refresh()} type="button"><RefreshCw aria-hidden="true" size={17} /></button>
      </div>
      {message ? <p className="profile-message" role="status">{message}</p> : null}
      {loading ? <div className="invitation-loading"><Clock3 aria-hidden="true" size={18} />{t("common.loading")}</div> : null}

      {incoming.length ? (
        <div className="invitation-group">
          <h3>{t("invitations.waitingForYou")}</h3>
          {incoming.map((invitation) => (
            <article className="invitation-card invitation-card--incoming" key={invitation.invitation_id}>
              <span className="invitation-avatar"><UserRound aria-hidden="true" size={18} /></span>
              <div><strong>{t("invitations.invitedBy", { username: invitation.host_username })}</strong><small>{dateTime.format(new Date(invitation.start_at))}</small></div>
              <div className="invitation-actions">
                <button aria-label={t("invitations.accept")} className="friend-icon-button is-accept" disabled={workingId === invitation.invitation_id} onClick={() => void respond(invitation.invitation_id, true)} type="button"><Check aria-hidden="true" size={18} /></button>
                <button aria-label={t("invitations.decline")} className="friend-icon-button" disabled={workingId === invitation.invitation_id} onClick={() => void respond(invitation.invitation_id, false)} type="button"><X aria-hidden="true" size={18} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {hosted.length ? (
        <div className="invitation-group">
          <h3>{t("invitations.yourLineups")}</h3>
          {hosted.map((lineup) => (
            <article className="lineup-card" key={lineup[0].reservation_id}>
              <header><div><strong>{dateTime.format(new Date(lineup[0].start_at))}</strong><small>{t("invitations.confirmedCount", { count: lineup.filter((item) => item.status === "accepted").length + 1 })}</small></div><UsersRound aria-hidden="true" size={19} /></header>
              <ul>
                <li><span className="invitation-avatar"><UserRound aria-hidden="true" size={15} /></span><strong>{t("invitations.you")}</strong><small className="lineup-status is-accepted">{t("invitations.confirmed")}</small></li>
                {lineup.map((invitation) => (
                  <li key={invitation.invitation_id}><span className="invitation-avatar"><UserRound aria-hidden="true" size={15} /></span><strong>@{invitation.invitee_username}</strong><small className={`lineup-status is-${invitation.status}`}>{t(`invitations.${invitation.status}` as TranslationKey)}</small></li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
