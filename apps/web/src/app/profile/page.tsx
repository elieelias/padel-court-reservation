import { PageHeading } from "@/components/page-heading";
import { PlayerProfile } from "@/components/player-profile";
import { hasSupabaseConfig } from "@/lib/config";

export const metadata = { title: "Account" };

export default function ProfilePage() {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="Profile" title="Your player hub">View your player information and keep track of every reservation.</PageHeading>
      <PlayerProfile enabled={hasSupabaseConfig} />
    </div>
  );
}
