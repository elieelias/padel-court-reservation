"use client";

import type { User } from "@supabase/supabase-js";
import { CalendarClock, CircleUserRound, History, LogOut, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PlayerProfile({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user);
        setLoading(false);
      }
    });

    return () => { active = false; };
  }, [enabled]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const fullName = typeof user?.user_metadata.full_name === "string" ? user.user_metadata.full_name : "Player";

  return (
    <div className="player-hub">
      <section className="panel player-card">
        <span className="profile-avatar"><CircleUserRound aria-hidden="true" size={38} /></span>
        {loading ? (
          <div><span className="eyebrow">Player information</span><h2>Loading profile…</h2></div>
        ) : user ? (
          <>
            <div><span className="eyebrow">Player information</span><h2>{fullName}</h2></div>
            <dl className="player-details">
              <div><dt><Phone aria-hidden="true" size={17} /> Mobile number</dt><dd>{user.phone ?? "Not available"}</dd></div>
            </dl>
            <button className="button button--secondary sign-out-button" onClick={() => void signOut()} type="button"><LogOut aria-hidden="true" size={17} /> Sign out</button>
          </>
        ) : (
          <>
            <div><span className="eyebrow">Player information</span><h2>Sign in to view your profile</h2></div>
            <p>Your name, mobile number, and reservations will appear here after you sign in.</p>
            <div className="button-row">
              <Link className="button button--primary" href="/auth/sign-in">Sign in</Link>
              <Link className="button button--secondary" href="/auth/sign-up">Register</Link>
            </div>
          </>
        )}
      </section>

      <div className="reservation-sections" id="reservations">
        <section className="panel reservation-list-card">
          <div className="section-heading"><div><span className="eyebrow">Upcoming</span><h2>Upcoming reservations</h2></div><CalendarClock aria-hidden="true" size={25} /></div>
          <div className="empty-reservation"><strong>No upcoming reservations</strong><span>Your next confirmed booking will appear here.</span><Link className="text-link" href="/book">Book a court</Link></div>
        </section>
        <section className="panel reservation-list-card">
          <div className="section-heading"><div><span className="eyebrow">Previous matches</span><h2>Reservation history</h2></div><History aria-hidden="true" size={25} /></div>
          <div className="empty-reservation"><strong>No reservation history</strong><span>Completed and cancelled reservations will appear here.</span></div>
        </section>
      </div>
    </div>
  );
}
