import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { EmailAuthForm } from "@/components/email-auth-form";
import { emailVerificationCodeEnabled, hasSupabaseConfig } from "@/lib/config";

export const metadata = { title: "Sign in" };

const authErrorMessages: Record<string, string> = {
  "invalid-link": "That sign-in link is invalid or has expired. Request a new verification email below.",
  "missing-code": "That sign-in link is incomplete. Request a new verification email below.",
  "missing-config": "Email login is not configured yet. Please try again shortly.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? authErrorMessages[error] : undefined;

  return (
    <div className="auth-wrap">
      <Link className="back-link" href="/"><ArrowLeft aria-hidden="true" size={18} /> Back to home</Link>
      <section className="auth-card">
        <span className="auth-icon"><LockKeyhole aria-hidden="true" size={26} /></span>
        <span className="eyebrow">Player access</span>
        <h1>Sign in</h1>
        <p>{emailVerificationCodeEnabled ? "Enter your email address. We’ll send a six-digit code and a secure sign-in button in the same email." : "Enter your email address. We’ll send you a secure sign-in link."}</p>
        {errorMessage ? <p className="form-message" role="alert">{errorMessage}</p> : null}
        <EmailAuthForm enabled={hasSupabaseConfig} mode="sign-in" />
        <p className="auth-switch">New player? <Link href="/auth/sign-up">Create an account</Link></p>
      </section>
    </div>
  );
}
