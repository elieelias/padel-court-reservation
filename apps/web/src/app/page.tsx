import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HeroCourtSimulation } from "@/components/hero-court-simulation";

export default function HomePage() {
  return (
    <div className="landing-page">
      <section className="hero landing-hero">
        <div className="hero__copy">
          <span className="eyebrow">Padel, made simple</span>
          <h1>Find the time.<br />Play the match.</h1>
          <p>Book the court for your group or open the match to players looking for their next game.</p>
          <div className="button-row">
            <Link className="button button--primary" href="/auth/sign-up">Join and book <ArrowRight aria-hidden="true" size={18} /></Link>
            <Link className="button button--secondary" href="/auth/sign-in">Sign in</Link>
          </div>
        </div>
        <HeroCourtSimulation />
      </section>

      <section className="steps-section landing-steps">
        <div><span className="eyebrow">How it works</span><h2>One account for every match</h2><p>Keep booking, player requests, and your match history together.</p></div>
        <ol className="steps-list">
          <li><strong>01</strong><span><b>Join with your phone</b>Register with your name and mobile number.</span></li>
          <li><strong>02</strong><span><b>Choose how to play</b>Book for your group or create an Open Court.</span></li>
          <li><strong>03</strong><span><b>Keep track</b>See upcoming reservations and match history in your profile.</span></li>
        </ol>
      </section>
    </div>
  );
}
