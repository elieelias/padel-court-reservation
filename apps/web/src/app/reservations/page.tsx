import { PageHeading } from "@/components/page-heading";
import { SetupState } from "@/components/setup-state";

export const metadata = { title: "Reservations" };

export default function ReservationsPage() {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="My reservations" title="Your matches, in one place">Review upcoming bookings, eligible cancellations, past matches, and payment status.</PageHeading>
      <SetupState context="reservations" />
    </div>
  );
}
