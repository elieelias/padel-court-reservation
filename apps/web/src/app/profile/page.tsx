import { CircleUserRound, Database, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { hasSupabaseConfig } from "@/lib/config";

export const metadata = { title: "Account" };

export default function ProfilePage() {
  return (
    <div className="page-stack">
      <PageHeading eyebrow="Account" title="Player profile">Sign in to manage the name and phone number used for reservations.</PageHeading>
      <section className="profile-grid">
        <article className="panel profile-card">
          <span className="profile-avatar"><CircleUserRound aria-hidden="true" size={40} /></span>
          <div><span className="eyebrow">Account status</span><h2>{hasSupabaseConfig ? "Ready to sign in" : "Backend setup required"}</h2></div>
          <p>{hasSupabaseConfig ? "Phone sign-in is ready to send one-time SMS codes." : "Add the Supabase connection and SMS provider to enable phone sign-in."}</p>
          <div className="button-row">
            <Link className="button button--primary" href="/auth/sign-in">Sign in</Link>
            <Link className="button button--secondary" href="/auth/sign-up">Create account</Link>
          </div>
        </article>
        <article className="panel privacy-card">
          <LockKeyhole aria-hidden="true" size={28} />
          <h2>Only what the booking needs</h2>
          <p>Registration asks only for a full name and mobile number. Returning players use their mobile number and a one-time SMS code.</p>
          <span className="status-chip"><Database aria-hidden="true" size={15} /> {hasSupabaseConfig ? "Supabase configured" : "Waiting for Supabase keys"}</span>
        </article>
      </section>
    </div>
  );
}
