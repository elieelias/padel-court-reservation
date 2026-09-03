import { ReservationHistory, type ReservationRow } from "@/features/booking/components/player-reservations";
import { ProfileSectionNav } from "@/features/profile/components/profile-section-nav";
import { isReservationHistoryEntry } from "@/features/profile/lib/reservation-history";
import { hasSupabaseConfig } from "@/lib/config";
import { getTranslator } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("profile.historyTitle") };
}

export default async function ProfileHistoryPage() {
  const { t } = await getTranslator();
  let reservations: ReservationRow[] = [];
  let loadError = false;
  if (hasSupabaseConfig) {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      // A booking belongs in history once it has ended. Its administrative
      // status may remain pending or confirmed until staff update it later.
      const { data, error } = await supabase
        .from("reservations")
        .select("id, host_id, start_at, end_at, type, status, price, payment_status")
        .neq("status", "cancelled")
        .order("start_at", { ascending: false });
      loadError = Boolean(error);
      reservations = ((data as ReservationRow[] | null) ?? []).filter((reservation) => isReservationHistoryEntry(reservation, new Date()));
    }
  }

  return (
    <div className="page-stack">
      <header className="profile-page-heading"><h1>{t("profile.profileTab")}</h1></header>
      <ProfileSectionNav active="history" />
      <ReservationHistory loadError={loadError} reservations={reservations} />
    </div>
  );
}
