import { BookingExperience } from "@/features/booking/components/booking-experience";
import { UpcomingReservations, type ReservationParticipant, type ReservationRow } from "@/features/booking/components/player-reservations";
import { ReservationInvitations } from "@/features/booking/components/reservation-invitations";
import { hasSupabaseConfig } from "@/lib/config";
import { getTranslator } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("metadata.book") };
}

export default async function BookPage() {
  let reservations: ReservationRow[] = [];
  let user = null;
  let playerName = "Player";
  let cancellationHours = 2;
  if (hasSupabaseConfig) {
    // Server-side loading keeps the initial reservation list private and avoids a client flash.
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    user = userData.user;
    if (user) {
      const now = new Date().toISOString();
      const [reservationsResult, settingsResult, profileResult] = await Promise.all([
        supabase.from("reservations").select("id, host_id, start_at, end_at, type, status, price, payment_status, pass_token, pass_code").in("status", ["pending", "confirmed"]).gt("end_at", now).order("start_at"),
        supabase.from("facility_settings").select("cancellation_hours").eq("id", 1).single(),
        supabase.from("profiles").select("username").eq("id", user.id).single(),
      ]);
      reservations = (reservationsResult.data as ReservationRow[] | null) ?? [];
      if (reservations.length) {
        const { data: participantData } = await supabase.rpc("get_reservation_receipt_players", { p_reservation_ids: reservations.map((reservation) => reservation.id) });
        const participantRows = (participantData ?? []) as Array<{ reservation_id: string; username: string; participant_role: "host" | "member"; unregistered_player_count: number }>;
        reservations = reservations.map((reservation) => {
          const rows = participantRows.filter((row) => row.reservation_id === reservation.id);
          return {
            ...reservation,
            participants: rows.map((row): ReservationParticipant => ({ role: row.participant_role, username: row.username })),
            unregistered_player_count: rows[0]?.unregistered_player_count ?? 0,
          };
        });
      }
      cancellationHours = settingsResult.data?.cancellation_hours ?? 2;
      playerName = profileResult.data?.username ? `@${profileResult.data.username}` : user.email ?? playerName;
    }
  }
  return <div className="book-page-stack"><BookingExperience />{user ? <ReservationInvitations /> : null}<UpcomingReservations cancellationHours={cancellationHours} initialReservations={reservations} initialUser={user} playerName={playerName} /></div>;
}
