import { BookingExperience } from "@/components/booking-experience";
import { UpcomingReservations, type ReservationRow } from "@/components/player-reservations";
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
      cancellationHours = settingsResult.data?.cancellation_hours ?? 2;
      playerName = profileResult.data?.username ? `@${profileResult.data.username}` : user.email ?? playerName;
    }
  }
  return <div className="book-page-stack"><BookingExperience /><UpcomingReservations cancellationHours={cancellationHours} initialReservations={reservations} initialUser={user} playerName={playerName} /></div>;
}
