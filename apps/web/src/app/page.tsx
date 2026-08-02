import { ArrowRight, CalendarDays, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { CourtMark } from "@/components/court-mark";

export default function HomePage() {
  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero__copy">
          <span className="eyebrow">Player reservations</span>
          <h1>Book the court.<br />Build the match.</h1>
          <p>Choose a free time for your group, or open the match when you still need players.</p>
          <div className="button-row">
            <Link className="button button--primary" href="/book">Book the court <ArrowRight aria-hidden="true" size={18} /></Link>
            <Link className="button button--secondary" href="/open-courts">Find an Open Court</Link>
          </div>
        </div>
        <div className="hero__court">
          <CourtMark />
          <div className="court-note court-note--one"><CalendarDays aria-hidden="true" size={18} /><span>Choose a free time</span></div>
          <div className="court-note court-note--two"><UsersRound aria-hidden="true" size={18} /><span>Up to four players</span></div>
          <div className="court-ball" aria-hidden="true" />
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel next-match">
          <div className="section-heading">
            <div><span className="eyebrow">Next match</span><h2>Your schedule is clear</h2></div>
            <CalendarDays aria-hidden="true" size={24} />
          </div>
          <p>Your next confirmed reservation will appear here.</p>
          <Link className="text-link" href="/book">Choose a time <ArrowRight aria-hidden="true" size={16} /></Link>
        </article>

        <article className="panel open-court-card">
          <Search aria-hidden="true" size={28} />
          <div><span className="eyebrow">Need players?</span><h2>Make it an Open Court</h2></div>
          <p>Set how many players are already confirmed. Other registered players can request the available places.</p>
          <Link className="text-link" href="/open-courts">Explore Open Courts <ArrowRight aria-hidden="true" size={16} /></Link>
        </article>
      </section>

      <section className="steps-section">
        <div><span className="eyebrow">A simple flow</span><h2>From free court to confirmed match</h2></div>
        <ol className="steps-list">
          <li><strong>01</strong><span><b>Choose a date</b>View only the times the facility can accept.</span></li>
          <li><strong>02</strong><span><b>Set the match</b>Book privately or invite requests with an Open Court.</span></li>
          <li><strong>03</strong><span><b>Confirm</b>The backend checks the slot again before saving.</span></li>
        </ol>
      </section>
    </div>
  );
}
