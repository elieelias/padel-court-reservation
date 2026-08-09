import { PageHeading } from "@/components/page-heading";
import { SetupState } from "@/components/setup-state";

export const metadata = { title: "Open Courts" };

export default function OpenCourtsPage() {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="Open Courts" title="Find your next match">Browse upcoming matches that still have a place, then send the host a request to join.</PageHeading>
      {/* <SetupState context="open-courts" /> */}
    </div>
  );
}
