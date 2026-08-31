"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/shared/preferences/language-provider";
import type { TranslationKey } from "@/lib/i18n";
import type { FriendRow } from "@/features/booking/lib/booking-calendar";

type LineupPlayer = { player_id: string; username: string; role: "host" | "member"; status: "accepted" | "pending" | "declined" };
type Lineup = {
  players: LineupPlayer[];
  status: "pending" | "confirmed" | "completed" | "cancelled" | "expired";
  type: "private" | "open";
  is_host: boolean;
  guest_count: number;
  start_at: string;
  cancellation_hours: number;
};

/** Load only when expanded; ownership and deadlines are also enforced by the database. */
export function ReservationLineup({ reservationId, userId, onLeft }: { reservationId: string; userId: string; onLeft?: () => void }) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [friendId, setFriendId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const { data, error: loadError } = await createClient().rpc("get_reservation_lineup", { p_reservation_id: reservationId });
    if (loadError) { setError(t("lineup.loadError")); return; }
    const result = data as Lineup;
    setLineup(result);
    setNow(Date.now());
    if (result.is_host) {
      const { data: friendData, error: friendError } = await createClient().rpc("list_friendships");
      if (!friendError) setFriends(((friendData ?? []) as FriendRow[]).filter((friend) => friend.status === "accepted"));
    }
  }, [reservationId, t]);

  useEffect(() => {
    if (!open) return;
    const load = window.setTimeout(() => void refresh(), 0);
    const tick = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => { window.clearTimeout(load); window.clearInterval(tick); window.removeEventListener("focus", onFocus); };
  }, [open, refresh]);

  async function act(action: "remove" | "leave" | "invite", playerId: string | null = null) {
    if (busy) return;
    if (action !== "invite" && !window.confirm(t(action === "leave" ? "lineup.leavePrompt" : "lineup.removePrompt"))) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const client = createClient();
      const { error: actionError } = action === "leave"
        ? await client.rpc("leave_reservation", { p_reservation_id: reservationId })
        : await client.rpc(action === "invite" ? "invite_reservation_friend" : "remove_reservation_player", { p_reservation_id: reservationId, p_player_id: playerId });
      if (actionError) { setError(locale === "ar" ? t("lineup.actionError") : actionError.message); return; }
      setMessage(t("lineup.updated"));
      setFriendId("");
      if (action === "leave") { setOpen(false); setLineup(null); onLeft?.(); }
      else await refresh();
      window.dispatchEvent(new Event("reservation-updated"));
      router.refresh();
    } catch { setError(t("lineup.actionError")); }
    finally { setBusy(false); }
  }

  const active = lineup && ["pending", "confirmed"].includes(lineup.status);
  const beforeStart = Boolean(active && new Date(lineup.start_at).getTime() > now);
  const beforeCutoff = Boolean(active && new Date(lineup.start_at).getTime() - now > lineup.cancellation_hours * 3_600_000);
  const choices = friends.filter((friend) => !lineup?.players.some((player) => player.player_id === friend.player_id && player.status !== "declined"));

  return (
    <div className="reservation-lineup">
      <button aria-expanded={open} className="reservation-pass-button" onClick={() => setOpen((value) => !value)} type="button"><UsersRound aria-hidden="true" size={17} />{t("lineup.manage")}</button>
      {open && <section aria-label={t("lineup.manage")} className="reservation-lineup__body">
        {error && <p role="alert" className="booking-confirmation-sheet__message">{error}</p>}
        {message && <p role="status">{message}</p>}
        {!lineup && !error && <p>{t("common.loading")}</p>}
        {lineup && <>
          <p className="reservation-lineup__status"><strong>{t(`status.${lineup.status}` as TranslationKey)}</strong>{lineup.status === "pending" && <span>{t(lineup.type === "private" ? "lineup.pendingPrivate" : "lineup.pendingOpen")}</span>}</p>
          <ul>
            {lineup.players.map((player) => <li key={player.player_id}>
              <div><Link href={`/players/${encodeURIComponent(player.username)}` as Route}>@{player.username}</Link><small>{player.role === "host" ? t("profile.hostPlayer") : t(`invitations.${player.status}` as TranslationKey)}</small></div>
              {lineup.is_host && player.role !== "host" && (player.status === "accepted" ? beforeCutoff : beforeStart) && <button className="reservation-cancel" disabled={busy} onClick={() => void act("remove", player.player_id)} type="button">{t(player.status === "accepted" ? "lineup.remove" : "lineup.withdraw")}</button>}
            </li>)}
            {lineup.guest_count > 0 && <li><div><strong>{t("profile.guestPlayers", { count: lineup.guest_count })}</strong><small>{t("profile.unregistered")}</small></div>{lineup.is_host && beforeCutoff && <button className="reservation-cancel" disabled={busy} onClick={() => void act("remove")} type="button">{t("lineup.removeGuest")}</button>}</li>}
          </ul>
          {lineup.is_host && beforeCutoff && <div className="reservation-lineup__invite">
            <label>{t("lineup.inviteFriend")}<select disabled={busy} value={friendId} onChange={(event) => setFriendId(event.target.value)}><option value="">{t("lineup.chooseFriend")}</option>{choices.map((friend) => <option key={friend.player_id} value={friend.player_id}>@{friend.username}</option>)}</select></label>
            <button className="button button--primary" disabled={busy || !friendId} onClick={() => void act("invite", friendId)} type="button">{t("lineup.sendInvitation")}</button>
          </div>}
          {!lineup.is_host && beforeCutoff && lineup.players.some((player) => player.player_id === userId) && <button className="reservation-cancel" disabled={busy} onClick={() => void act("leave")} type="button">{t("lineup.leave")}</button>}
          {beforeStart && <p className="reservation-lineup__help">{t("lineup.cutoff", { hours: lineup.cancellation_hours })}</p>}
        </>}
      </section>}
    </div>
  );
}
