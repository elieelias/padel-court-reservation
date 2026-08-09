"use client";

import { CheckCircle2, PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { emailVerificationCodeEnabled, siteUrl } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";
type AuthStep = "details" | "link-sent" | "verify";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function friendlyAuthError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("email address not authorized")) {
    return "Email delivery is still in test mode. Connect a production email provider in Supabase, then try again.";
  }
  if (normalizedMessage.includes("email provider") || normalizedMessage.includes("email signups are disabled")) {
    return "Email login is not enabled in Supabase yet.";
  }
  if (normalizedMessage.includes("rate limit")) {
    return "Please wait a moment before requesting another code.";
  }
  if (normalizedMessage.includes("token") || normalizedMessage.includes("expired")) {
    return "That code is incorrect or has expired. Check the email or request a new code.";
  }
  return message;
}

export function EmailAuthForm({ enabled, mode }: { enabled: boolean; mode: AuthMode }) {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("details");
  const [fullName, setFullName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const isSignUp = mode === "sign-up";

  async function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setMessage("");

    const normalizedEmail = normalizeEmail(emailInput);
    if (!isValidEmail(normalizedEmail)) {
      setMessage("Enter a valid email address.");
      return;
    }

    if (isSignUp && fullName.trim().length < 2) {
      setMessage("Enter your full name.");
      return;
    }

    if (!enabled) {
      setMessage("Email authentication will activate after Supabase is configured.");
      return;
    }

    setPending(true);
    const { error } = await createClient().auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: isSignUp,
        emailRedirectTo: `${siteUrl}/auth/confirm?next=/book`,
        ...(isSignUp ? { data: { full_name: fullName.trim() } } : {}),
      },
    });
    setPending(false);

    if (error) {
      setMessage(friendlyAuthError(error.message));
      return;
    }

    setEmail(normalizedEmail);
    setVerificationCode("");
    setStep(emailVerificationCodeEnabled ? "verify" : "link-sent");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!/^\d{6}$/.test(verificationCode)) {
      setMessage("Enter the six-digit code from your email.");
      return;
    }

    setPending(true);
    const { error } = await createClient().auth.verifyOtp({
      email,
      token: verificationCode,
      type: "email",
    });
    setPending(false);

    if (error) {
      setMessage(friendlyAuthError(error.message));
      return;
    }

    router.replace("/book");
    router.refresh();
  }

  if (step === "verify") {
    return (
      <form className="auth-form" onSubmit={verifyCode}>
        <div className="code-sent">
          <CheckCircle2 aria-hidden="true" size={20} />
          <span>Verification email sent to <strong>{email}</strong></span>
        </div>
        <label>
          Six-digit code
          <input
            aria-describedby="verification-help"
            autoComplete="one-time-code"
            className="otp-input"
            inputMode="numeric"
            maxLength={6}
            name="verification-code"
            onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            pattern="[0-9]{6}"
            placeholder="000000"
            required
            type="text"
            value={verificationCode}
          />
        </label>
        <p className="form-note" id="verification-help">Enter the code, or use the sign-in button in the same email. Check your spam folder if it does not appear.</p>
        <button className="button button--primary" disabled={pending} type="submit">
          {pending ? "Verifying…" : isSignUp ? "Verify and create account" : "Verify and sign in"}
        </button>
        <div className="auth-actions">
          <button className="text-button" type="button" onClick={() => { setStep("details"); setMessage(""); }}>
            <PencilLine aria-hidden="true" size={15} /> Change email
          </button>
          <button className="text-button" type="button" onClick={() => void sendCode()} disabled={pending}>
            {pending ? "Sending…" : "Send again"}
          </button>
        </div>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
    );
  }

  if (step === "link-sent") {
    return (
      <div className="auth-form">
        <div className="code-sent">
          <CheckCircle2 aria-hidden="true" size={20} />
          <span>Sign-in link sent to <strong>{email}</strong></span>
        </div>
        <p className="form-note">Open the email and select the secure sign-in button to continue. Check your spam folder if it does not appear.</p>
        <div className="auth-actions">
          <button className="text-button" type="button" onClick={() => { setStep("details"); setMessage(""); }}>
            <PencilLine aria-hidden="true" size={15} /> Change email
          </button>
          <button className="text-button" type="button" onClick={() => void sendCode()} disabled={pending}>
            {pending ? "Sending…" : "Send again"}
          </button>
        </div>
        {message && <p className="form-message" role="status">{message}</p>}
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={sendCode}>
      {isSignUp && (
        <label>
          Full name
          <input
            name="full-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your full name"
            required
          />
        </label>
      )}
      <label>
        Email address
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={emailInput}
          onChange={(event) => setEmailInput(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? "Sending…" : emailVerificationCodeEnabled ? "Email me a verification code" : "Email me a sign-in link"}
      </button>
      <p className="form-note">No password needed.</p>
      {!enabled && <p className="form-note">The interface is ready; email delivery activates after the backend is configured.</p>}
      {message && <p className="form-message" role="status">{message}</p>}
    </form>
  );
}
