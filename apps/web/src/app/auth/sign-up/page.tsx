import { ArrowLeft, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { PhoneAuthForm } from "@/components/phone-auth-form";
import { hasSupabaseConfig } from "@/lib/config";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <div className="auth-wrap">
      <Link className="back-link" href="/"><ArrowLeft aria-hidden="true" size={18} /> Back to home</Link>
      <section className="auth-card">
        <span className="auth-icon"><UserRoundPlus aria-hidden="true" size={26} /></span>
        <span className="eyebrow">New player</span>
        <h1>Create account</h1>
        <p>Enter your name and mobile number. That’s all we need to get started.</p>
        <PhoneAuthForm enabled={hasSupabaseConfig} mode="sign-up" />
        <p className="auth-switch">Already registered? <Link href="/auth/sign-in">Sign in</Link></p>
      </section>
    </div>
  );
}
