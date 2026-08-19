import { FriendManager } from "@/components/friend-manager";
import { ProfileSectionNav } from "@/components/profile-section-nav";
import { getTranslator } from "@/lib/i18n-server";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("profile.friendsTab") };
}

export default async function ProfileFriendsPage() {
  const { t } = await getTranslator();
  return (
    <div className="page-stack">
      <header className="profile-page-heading"><h1>{t("profile.profileTab")}</h1></header>
      <ProfileSectionNav active="friends" />
      <div className="profile-friends-page"><FriendManager /></div>
    </div>
  );
}
