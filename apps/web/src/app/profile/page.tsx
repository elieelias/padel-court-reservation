import type { User } from "@supabase/supabase-js";
import { PlayerProfile, type ProfileRow } from "@/components/player-profile";
import { ProfileSectionNav } from "@/components/profile-section-nav";
import { hasSupabaseConfig } from "@/lib/config";
import { getTranslator } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("metadata.profile") };
}

export default async function ProfilePage() {
  const { t } = await getTranslator();
  let initialUser: User | null = null;
  let initialProfile: ProfileRow = { username: "", full_name: null, phone_number: null };
  let friendCount = 0;
  let reservationCount = 0;

  if (hasSupabaseConfig) {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    initialUser = userData.user;

    if (initialUser) {
      const [profileResult, friendshipsResult, reservationResult] = await Promise.all([
        supabase.from("profiles").select("username, full_name, phone_number").eq("id", initialUser.id).single(),
        supabase.rpc("list_friendships"),
        supabase.from("reservations").select("id", { count: "exact", head: true }),
      ]);
      initialProfile = (profileResult.data as ProfileRow | null) ?? initialProfile;
      friendCount = ((friendshipsResult.data as { status: string }[] | null) ?? []).filter((friendship) => friendship.status === "accepted").length;
      reservationCount = reservationResult.count ?? 0;
    }
  }

  return (
    <div className="page-stack">
      <header className="profile-page-heading"><h1>{t("profile.profileTab")}</h1></header>
      <ProfileSectionNav active="profile" />
      <PlayerProfile
        enabled={hasSupabaseConfig}
        friendCount={friendCount}
        initialProfile={initialProfile}
        initialUser={initialUser}
        reservationCount={reservationCount}
      />
    </div>
  );
}
