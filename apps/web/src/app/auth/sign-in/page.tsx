import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { PhoneAuthForm } from "@/components/phone-auth-form";
import { hasSupabaseConfig } from "@/lib/config";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="auth-wrap">
      <Link className="back-link" href="/profile"><ArrowLeft aria-hidden="true" size={18} /> Back to account</Link>
      <section className="auth-card">
        <span className="auth-icon"><LockKeyhole aria-hidden="true" size={26} /></span>
        <span className="eyebrow">Player access</span>
        <h1>Sign in</h1>
        <p>Enter your mobile number. We’ll send a one-time code by SMS.</p>
        <PhoneAuthForm enabled={hasSupabaseConfig} mode="sign-in" />
        <p className="auth-switch">New player? <Link href="/auth/sign-up">Create an account</Link></p>
      </section>
    </div>
  );
}
