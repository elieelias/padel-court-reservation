import { Cable, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function SetupState({ context }: { context: "availability" | "open-courts" | "reservations" }) {
  const copy = {
    availability: {
      title: "Availability is ready for its data connection",
      text: "Once the facility schedule and blocked periods are connected, free times will appear here.",
    },
    "open-courts": {
      title: "Open Courts will appear here",
      text: "Live matches with available places will load after the reservation database is connected.",
    },
    reservations: {
      title: "No reservations to show yet",
      text: "Sign in after Supabase is connected to see upcoming bookings and reservation history.",
    },
  }[context];

  return (
    <section className="setup-state">
      <span className="setup-state__icon"><Cable aria-hidden="true" size={28} /></span>
      <div>
        <span className="status-chip"><CheckCircle2 aria-hidden="true" size={15} /> Interface ready</span>
        <h2>{copy.title}</h2>
        <p>{copy.text}</p>
      </div>
      <Link className="button button--secondary" href="/profile">View account setup</Link>
    </section>
  );
}
