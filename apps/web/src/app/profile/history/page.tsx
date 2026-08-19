import { ProfileSectionNav } from "@/components/profile-section-nav";
import { ReservationHistory, type ReservationRow } from "@/components/player-reservations";
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
  if (hasSupabaseConfig) {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data } = await supabase.from("reservations").select("id, host_id, start_at, end_at, type, status, price, payment_status").in("status", ["completed", "cancelled", "expired"]).order("start_at", { ascending: false });
      reservations = (data as ReservationRow[] | null) ?? [];
    }
  }

  return (
    <div className="page-stack">
      <header className="profile-page-heading"><h1>{t("profile.profileTab")}</h1></header>
      <ProfileSectionNav active="history" />
      <ReservationHistory reservations={reservations} />
    </div>
  );
}
