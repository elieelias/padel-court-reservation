import { ArrowLeft, CircleUserRound, Clock3, UsersRound } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslator } from "@/lib/i18n-server";
import { intlLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

type OpenCourtDetail = {
  reservation_id: string;
  host_username: string;
  start_at: string;
  end_at: string;
  player_count: number;
  available_spots: number;
  participant_username: string;
  participant_role: string;
  unregistered_player_count: number;
};

export default async function OpenCourtDetailPage({ params }: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await params;
  const { locale, t } = await getTranslator();
  const { data, error } = await (await createClient()).rpc("get_open_court_details", { p_reservation_id: reservationId });
  const rows = (data as OpenCourtDetail[] | null) ?? [];
  if (error || !rows.length) notFound();

  const court = rows[0];
  const date = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", month: "long", day: "numeric" }).format(new Date(court.start_at));
  const time = new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit" });

  return (
    <div className="page-stack open-court-detail-page">
      <Link className="back-link" href="/open-courts"><ArrowLeft aria-hidden="true" className="directional-icon" size={17} />{t("openCourts.back")}</Link>
      <section className="panel open-court-detail-card">
        <header>
          <span className="eyebrow">{t("openCourts.reservationDetails")}</span>
          <h1>{t("openCourts.hostedBy", { username: court.host_username })}</h1>
          <div className="open-court-detail-meta"><span><Clock3 aria-hidden="true" size={16} />{date} · {time.format(new Date(court.start_at))}–{time.format(new Date(court.end_at))}</span><span><UsersRound aria-hidden="true" size={16} />{t("openCourts.playersOfFour", { count: court.player_count })}</span></div>
        </header>

        <div className="participant-section">
          <div className="section-heading"><div><span className="eyebrow">{t("openCourts.lineup")}</span><h2>{t("openCourts.playersInReservation")}</h2></div><span className="status-chip">{t("openCourts.spotsLeft", { count: court.available_spots })}</span></div>
          <div className="participant-grid">
            {rows.map((participant) => (
              <Link className="participant-card" href={`/players/${encodeURIComponent(participant.participant_username)}` as Route} key={participant.participant_username}>
                <span className="friend-avatar"><CircleUserRound aria-hidden="true" size={20} /></span>
                <span><strong>@{participant.participant_username}</strong><small>{participant.participant_role === "host" ? t("openCourts.host") : t("openCourts.confirmedPlayer")}</small></span>
              </Link>
            ))}
            {Array.from({ length: court.unregistered_player_count }, (_, index) => <div className="participant-card participant-card--guest" key={`guest-${index}`}><span className="friend-avatar"><UsersRound aria-hidden="true" size={19} /></span><span><strong>{t("openCourts.guestPlayer")}</strong><small>{t("openCourts.withHost")}</small></span></div>)}
          </div>
        </div>
      </section>
    </div>
  );
}
