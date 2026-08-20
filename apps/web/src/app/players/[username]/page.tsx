import { ArrowLeft, CircleUserRound, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslator } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

type PublicPlayer = {
  player_id: string;
  username: string;
  friend_count: number;
  reservation_count: number;
  relationship_status: string | null;
  relationship_direction: "self" | "none" | "friends" | "incoming" | "outgoing";
  is_self: boolean;
};

export default async function PublicPlayerPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { t } = await getTranslator();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_player_public_profile", { p_username: decodeURIComponent(username) });
  const player = (data as PublicPlayer[] | null)?.[0];

  if (error || !player) notFound();

  const relationship = player.relationship_direction === "self"
    ? t("publicProfile.thisIsYou")
    : player.relationship_direction === "friends"
      ? t("publicProfile.friend")
      : player.relationship_direction === "incoming"
        ? t("publicProfile.requestReceived")
        : player.relationship_direction === "outgoing"
          ? t("publicProfile.requestSent")
          : t("publicProfile.player");

  return (
    <div className="page-stack public-player-page">
      <Link className="back-link" href="/open-courts"><ArrowLeft aria-hidden="true" className="directional-icon" size={17} />{t("publicProfile.back")}</Link>
      <section className="panel public-player-card">
        <div className="profile-avatar profile-avatar--large"><CircleUserRound aria-hidden="true" size={54} /></div>
        <div className="public-player-card__identity"><span className="eyebrow">{t("publicProfile.profile")}</span><h1>@{player.username}</h1><span className="public-player-relationship">{relationship}</span></div>
        <div className="public-player-stats" aria-label={t("publicProfile.statsLabel")}>
          <div><UsersRound aria-hidden="true" size={18} /><strong>{player.friend_count}</strong><span>{t("publicProfile.friends")}</span></div>
          <div><Trophy aria-hidden="true" size={18} /><strong>{player.reservation_count}</strong><span>{t("publicProfile.reservations")}</span></div>
        </div>
        <p className="public-player-privacy">{t("publicProfile.privacy")}</p>
      </section>
    </div>
  );
}
