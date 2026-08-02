import { CalendarDays, Clock3, ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { SetupState } from "@/components/setup-state";

export const metadata = { title: "Book" };

export default function BookPage() {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="Book the court" title="Choose a free time">The live schedule will combine opening hours, blocked periods, and confirmed reservations for the single court.</PageHeading>
      <div className="booking-layout">
        <section className="panel calendar-shell">
          <div className="section-heading"><div><span className="eyebrow">Step 1 of 3</span><h2>Select a date and time</h2></div><CalendarDays aria-hidden="true" size={24} /></div>
          <SetupState context="availability" />
        </section>
        <aside className="panel booking-summary">
          <span className="eyebrow">Booking summary</span>
          <h2>No time selected</h2>
          <dl>
            <div><dt><Clock3 aria-hidden="true" size={17} /> Duration</dt><dd>—</dd></div>
            <div><dt>Reservation type</dt><dd>—</dd></div>
          </dl>
          <button className="button button--primary" type="button" disabled>Continue</button>
          <p><ShieldCheck aria-hidden="true" size={17} /> Availability is checked again when you confirm.</p>
        </aside>
      </div>
    </div>
  );
}
