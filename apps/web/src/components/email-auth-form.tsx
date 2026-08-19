"use client";

import { CheckCircle2, PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { defaultCountryCode, emailVerificationCodeEnabled, siteUrl } from "@/lib/config";
import type { TranslationKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";
type AuthStep = "details" | "link-sent" | "verify";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUsername(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/.test(value.trim());
}

function normalizePhoneNumber(value: string) {
  const countryDigits = defaultCountryCode.replace(/\D/g, "") || "961";
  const trimmedValue = value.trim();

  if (trimmedValue.startsWith("+")) {
    return `+${trimmedValue.slice(1).replace(/\D/g, "")}`;
  }

  if (trimmedValue.startsWith("00")) {
    return `+${trimmedValue.slice(2).replace(/\D/g, "")}`;
  }

  const digits = trimmedValue.replace(/\D/g, "");
  if (digits.startsWith(countryDigits)) return `+${digits}`;

  return `+${countryDigits}${digits.replace(/^0+/, "")}`;
}

function isValidPhoneNumber(value: string) {
  return /^[+\d\s().-]+$/.test(value.trim()) && /^\+[1-9]\d{7,14}$/.test(normalizePhoneNumber(value));
}

function friendlyAuthError(message: string, t: (key: TranslationKey) => string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("email address not authorized")) {
    return t("auth.testMode");
  }
  if (normalizedMessage.includes("email provider") || normalizedMessage.includes("email signups are disabled")) {
    return t("auth.providerDisabled");
  }
  if (normalizedMessage.includes("rate limit")) {
    return t("auth.rateLimit");
  }
  if (normalizedMessage.includes("token") || normalizedMessage.includes("expired")) {
    return t("auth.badCode");
  }
  return message;
}

export function EmailAuthForm({ enabled, mode }: { enabled: boolean; mode: AuthMode }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("details");
  const [username, setUsername] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
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
    const trimmedUsername = username.trim();
    const normalizedPhone = normalizePhoneNumber(phoneInput);

    if (isSignUp) {
      if (!isValidUsername(trimmedUsername)) {
        setMessage(t("auth.validUsername"));
        return;
      }
      if (!isValidPhoneNumber(phoneInput)) {
        setMessage(t("auth.validPhone", { example: `${defaultCountryCode} 70 123 456` }));
        return;
      }
    }

    if (!isValidEmail(normalizedEmail)) {
      setMessage(t("auth.validEmail"));
      return;
    }

    if (!enabled) {
      setMessage(t("auth.notConfigured"));
      return;
    }

    setPending(true);
    const supabase = createClient();
    if (isSignUp) {
      const { data: available, error: availabilityError } = await supabase.rpc("username_available", { p_username: trimmedUsername });
      if (availabilityError || !available) {
        setPending(false);
        setMessage(availabilityError ? t("auth.usernameCheckError") : t("auth.usernameTaken"));
        return;
      }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: isSignUp,
        emailRedirectTo: `${siteUrl}/auth/confirm?next=/book`,
        ...(isSignUp ? { data: { username: trimmedUsername, full_name: trimmedUsername, phone_number: normalizedPhone } } : {}),
      },
    });
    setPending(false);

    if (error) {
      setMessage(friendlyAuthError(error.message, t));
      return;
    }

    setEmail(normalizedEmail);
    setVerificationCode("");
    setStep(emailVerificationCodeEnabled ? "verify" : "link-sent");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!/^\d{8}$/.test(verificationCode)) {
      setMessage(t("auth.enterCode"));
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
      setMessage(friendlyAuthError(error.message, t));
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
          <span>{t("auth.emailSent", { email })}</span>
        </div>
        <label>
          {t("auth.eightDigitCode")}
          <input
            aria-describedby="verification-help"
            autoComplete="one-time-code"
            className="otp-input"
            inputMode="numeric"
            maxLength={8}
            name="verification-code"
            onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
            pattern="[0-9]{8}"
            placeholder="00000000"
            required
            type="text"
            value={verificationCode}
          />
        </label>
        <p className="form-note" id="verification-help">{t("auth.codeHelp")}</p>
        <button className="button button--primary" disabled={pending} type="submit">
          {pending ? t("auth.verifying") : isSignUp ? t("auth.verifyCreate") : t("auth.verifySignIn")}
        </button>
        <div className="auth-actions">
          <button className="text-button" type="button" onClick={() => { setStep("details"); setMessage(""); }}>
            <PencilLine aria-hidden="true" size={15} /> {t("auth.changeEmail")}
          </button>
          <button className="text-button" type="button" onClick={() => void sendCode()} disabled={pending}>
            {pending ? t("auth.sending") : t("auth.sendAgain")}
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
          <span>{t("auth.linkSent", { email })}</span>
        </div>
        <p className="form-note">{t("auth.linkHelp")}</p>
        <div className="auth-actions">
          <button className="text-button" type="button" onClick={() => { setStep("details"); setMessage(""); }}>
            <PencilLine aria-hidden="true" size={15} /> {t("auth.changeEmail")}
          </button>
          <button className="text-button" type="button" onClick={() => void sendCode()} disabled={pending}>
            {pending ? t("auth.sending") : t("auth.sendAgain")}
          </button>
        </div>
        {message && <p className="form-message" role="status">{message}</p>}
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={sendCode}>
      {isSignUp && (
        <>
          <div className="auth-language-setting">
            <span>{t("language.label")}</span>
            <LanguageSwitcher />
          </div>
          <label>
            {t("auth.username")}
            <input
              aria-describedby="username-help"
              autoCapitalize="none"
              autoComplete="username"
              maxLength={30}
              minLength={3}
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,29}"
              placeholder={t("auth.usernamePlaceholder")}
              required
              type="text"
              value={username}
            />
          </label>
          <p className="form-note form-note--field" id="username-help">{t("auth.usernameHelp")}</p>
          <label>
            {t("auth.phone")}
            <input
              aria-describedby="phone-number-help"
              autoComplete="tel"
              inputMode="tel"
              maxLength={24}
              name="phone-number"
              onChange={(event) => setPhoneInput(event.target.value)}
              placeholder={`${defaultCountryCode} 70 123 456`}
              required
              type="tel"
              value={phoneInput}
            />
          </label>
          <p className="form-note form-note--field" id="phone-number-help">{t("auth.phoneHelp")}</p>
        </>
      )}
      <label>
        {t("auth.email")}
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={emailInput}
          onChange={(event) => setEmailInput(event.target.value)}
          placeholder={t("auth.emailPlaceholder")}
          required
        />
      </label>
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t("auth.sending") : emailVerificationCodeEnabled ? t("auth.sendCode") : t("auth.sendLink")}
      </button>
      <p className="form-note">{t("auth.noPassword")}</p>
      {!enabled && <p className="form-note">{t("auth.setupPending")}</p>}
      {message && <p className="form-message" role="status">{message}</p>}
    </form>
  );
}
