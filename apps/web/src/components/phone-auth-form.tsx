"use client";

import { CheckCircle2, PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";
type AuthStep = "details" | "code";

function normalizePhoneNumber(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) return `+${digits}`;

  const countryCode = (
    process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE?.replace(/\D/g, "") || "961"
  );
  const nationalNumber = digits.replace(/^0+/, "");
  return `+${countryCode}${nationalNumber}`;
}

function isValidPhoneNumber(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function friendlyAuthError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("unsupported phone provider") || normalizedMessage.includes("phone provider disabled")) {
    return "Phone login is not enabled in Supabase yet. Finish the SMS provider setup, then try again.";
  }
  if (normalizedMessage.includes("rate limit")) {
    return "Please wait a moment before requesting another code.";
  }
  if (normalizedMessage.includes("invalid")) {
    return "That code is not correct. Check the SMS and try again.";
  }
  return message;
}

export function PhoneAuthForm({ enabled, mode }: { enabled: boolean; mode: AuthMode }) {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("details");
  const [fullName, setFullName] = useState<string>("");
  const [phoneInput, setPhoneInput] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const isSignUp = mode === "sign-up";

  async function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setMessage("");

    const normalizedPhone = normalizePhoneNumber(phoneInput ?? "");
    if (!isValidPhoneNumber(normalizedPhone)) {
      setMessage("Enter a valid mobile number, including the country code if it is not Lebanese.");
      return;
    }

    if (isSignUp && fullName.trim().length < 2) {
      setMessage("Enter your full name.");
      return;
    }

    if (!enabled) {
      setMessage("Phone authentication will activate after Supabase and an SMS provider are configured.");
      return;
    }

    setPending(true);
    const { error } = await createClient().auth.signInWithOtp({
      phone: normalizedPhone,
      options: {
        shouldCreateUser: isSignUp,
        ...(isSignUp ? { data: { full_name: fullName.trim() } } : {}),
      },
    });
    setPending(false);

    if (error) {
      setMessage(friendlyAuthError(error.message));
      return;
    }

    setPhone(normalizedPhone);
    setStep("code");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = String(form.get("code")).replace(/\D/g, "");

    if (token.length !== 6) {
      setMessage("Enter the six-digit code from the SMS.");
      return;
    }

    setPending(true);
    setMessage("");
    const { error } = await createClient().auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    setPending(false);

    if (error) {
      setMessage(friendlyAuthError(error.message));
      return;
    }

    router.replace("/book");
    router.refresh();
  }

  if (step === "code") {
    return (
      <form className="auth-form" onSubmit={verifyCode}>
        <div className="code-sent">
          <CheckCircle2 aria-hidden="true" size={20} />
          <span>Code sent to <strong>{phone}</strong></span>
        </div>
        <label>
          Six-digit code
          <input
            className="otp-input"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            required
            autoFocus
          />
        </label>
        <button className="button button--primary" type="submit" disabled={pending}>
          {pending ? "Checking code…" : "Continue"}
        </button>
        <div className="auth-actions">
          <button className="text-button" type="button" onClick={() => { setStep("details"); setMessage(""); }}>
            <PencilLine aria-hidden="true" size={15} /> Change number
          </button>
          <button className="text-button" type="button" onClick={() => void sendCode()} disabled={pending}>
            Send again
          </button>
        </div>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
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
            value={fullName ?? ""}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your full name"
            required
          />
        </label>
      )}
      <label>
        Mobile number
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phoneInput ?? ""}
          onChange={(event) => setPhoneInput(event.target.value)}
          placeholder="03 123 456 or +961 71 123 456"
          required
        />
      </label>
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? "Sending code…" : "Send code"}
      </button>
      <p className="form-note">We’ll text you a six-digit code. No password needed.</p>
      {!enabled && <p className="form-note">The interface is ready; SMS delivery activates after the backend is configured.</p>}
      {message && <p className="form-message" role="status">{message}</p>}
    </form>
  );
}
