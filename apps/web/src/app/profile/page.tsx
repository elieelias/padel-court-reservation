import type { User } from "@supabase/supabase-js";
import { PageHeading } from "@/components/page-heading";
import { PlayerProfile, type ProfileRow, type ReservationRow } from "@/components/player-profile";
import { hasSupabaseConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Account" };

export default async function ProfilePage() {
  let initialUser: User | null = null;
  let initialProfile: ProfileRow = { full_name: null, phone_number: null };
  let initialReservations: ReservationRow[] = [];
  let initialCancellationHours = 2;

  if (hasSupabaseConfig) {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    initialUser = userData.user;

    if (initialUser) {
      const [profileResult, reservationResult, settingsResult] = await Promise.all([
        supabase.from("profiles").select("full_name, phone_number").eq("id", initialUser.id).single(),
        supabase.from("reservations").select("id, host_id, start_at, end_at, type, status, price, payment_status").order("start_at", { ascending: false }),
        supabase.from("facility_settings").select("cancellation_hours").eq("id", 1).single(),
      ]);
      initialProfile = (profileResult.data as ProfileRow | null) ?? initialProfile;
      initialReservations = (reservationResult.data as ReservationRow[] | null) ?? [];
      initialCancellationHours = settingsResult.data?.cancellation_hours ?? 2;
    }
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow="Profile" title="Your player hub">View your player information and keep track of every reservation.</PageHeading>
      <PlayerProfile
        enabled={hasSupabaseConfig}
        initialCancellationHours={initialCancellationHours}
        initialProfile={initialProfile}
        initialReservations={initialReservations}
        initialUser={initialUser}
      />
    </div>
  );
}
