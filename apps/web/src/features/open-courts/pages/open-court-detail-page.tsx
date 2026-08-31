import { ArrowLeft, CircleUserRound, Clock3, ListOrdered, UsersRound } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslator } from "@/lib/i18n-server";
import { intlLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { ReservationLineup } from "@/features/booking/components/reservation-lineup";

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

type WaitlistPlayer = {
  waitlist_id: string;
  player_username: string;
  queue_position: number;
  joined_at: string;
};

export default async function OpenCourtDetailPage({ params }: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await params;
  const { locale, t } = await getTranslator();
  const supabase = await createClient();
  const [{ data, error }, { data: waitlistData }] = await Promise.all([
    supabase.rpc("get_open_court_details", { p_reservation_id: reservationId }),
    supabase.rpc("list_open_court_waitlist", { p_reservation_id: reservationId }),
  ]);
  const rows = (data as OpenCourtDetail[] | null) ?? [];
  const waitlist = (waitlistData as WaitlistPlayer[] | null) ?? [];
  if (error || !rows.length) notFound();

  const court = rows[0];
  const { data: authData } = await supabase.auth.getUser();
  const { data: ownPlace } = authData.user
    ? await supabase.from("reservation_participants").select("player_id").eq("reservation_id", reservationId).eq("player_id", authData.user.id).maybeSingle()
    : { data: null };
  const date = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", month: "long", day: "numeric" }).format(new Date(court.start_at));
  const time = new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit" });

  return (
    <div className="page-stack open-court-detail-page">
      <Link className="back-link" href="/open-courts"><ArrowLeft aria-hidden="true" className="directional-icon" size={17} />{t("openCourts.back")}</Link>
      <section className="panel open-court-detail-card">
        <header>
          <span className="eyebrow">{t("openCourts.reservationDetails")}</span>
          <h1>{t("openCourts.hostedBy", { username: court.host_username })}</h1>
          <span className={`reservation-status reservation-status--${court.player_count === 4 ? "confirmed" : "pending"}`}>{t(court.player_count === 4 ? "status.confirmed" : "status.pending")}</span>
          {court.player_count < 4 && <p>{t("lineup.pendingOpen")}</p>}
          {4 - court.player_count - court.available_spots > 0 && <p>{t("openCourts.heldPlaces", { count: 4 - court.player_count - court.available_spots })}</p>}
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

        {ownPlace && authData.user && <ReservationLineup reservationId={reservationId} userId={authData.user.id} />}
        {waitlist.length > 0 && (
          <div className="participant-section open-court-host-waitlist">
            <div className="section-heading">
              <div><span className="eyebrow">{t("waitlist.hostEyebrow")}</span><h2>{t("waitlist.hostQueue")}</h2></div>
              <span className="status-chip"><ListOrdered aria-hidden="true" size={14} />{t("waitlist.waitingCount", { count: waitlist.length })}</span>
            </div>
            <p>{t("waitlist.hostQueueDescription")}</p>
            <ol className="open-court-waitlist-list">
              {waitlist.map((player) => (
                <li key={player.waitlist_id}>
                  <span>{player.queue_position}</span>
                  <Link className="participant-card" href={`/players/${encodeURIComponent(player.player_username)}` as Route}>
                    <span className="friend-avatar"><CircleUserRound aria-hidden="true" size={20} /></span>
                    <span><strong>@{player.player_username}</strong><small>{t("waitlist.nextInLine", { position: player.queue_position })}</small></span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
