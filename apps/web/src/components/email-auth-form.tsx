"use client";

import { CheckCircle2, PencilLine } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";
type AuthStep = "details" | "sent";

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
    return "Please wait a moment before requesting another link.";
  }
  return message;
}

export function EmailAuthForm({ enabled, mode }: { enabled: boolean; mode: AuthMode }) {
  const [step, setStep] = useState<AuthStep>("details");
  const [fullName, setFullName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const isSignUp = mode === "sign-up";

  async function sendLink(event?: FormEvent<HTMLFormElement>) {
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
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/book`,
        ...(isSignUp ? { data: { full_name: fullName.trim() } } : {}),
      },
    });
    setPending(false);

    if (error) {
      setMessage(friendlyAuthError(error.message));
      return;
    }

    setEmail(normalizedEmail);
    setStep("sent");
  }

  if (step === "sent") {
    return (
      <div className="auth-form">
        <div className="code-sent">
          <CheckCircle2 aria-hidden="true" size={20} />
          <span>Link sent to <strong>{email}</strong></span>
        </div>
        <p className="form-note">Open the email on this device and select the sign-in link to continue. Check your spam folder if it does not appear.</p>
        <div className="auth-actions">
          <button className="text-button" type="button" onClick={() => { setStep("details"); setMessage(""); }}>
            <PencilLine aria-hidden="true" size={15} /> Change email
          </button>
          <button className="text-button" type="button" onClick={() => void sendLink()} disabled={pending}>
            {pending ? "Sending…" : "Send again"}
          </button>
        </div>
        {message && <p className="form-message" role="status">{message}</p>}
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={sendLink}>
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
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </button>
      <p className="form-note">No password needed.</p>
      {!enabled && <p className="form-note">The interface is ready; email delivery activates after the backend is configured.</p>}
      {message && <p className="form-message" role="status">{message}</p>}
    </form>
  );
}
