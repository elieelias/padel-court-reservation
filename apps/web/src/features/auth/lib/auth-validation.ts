import { defaultCountryCode } from "@/lib/config";
import type { TranslationKey } from "@/lib/i18n";

export type AuthMode = "sign-in" | "sign-up";
export type AuthStep = "details" | "link-sent" | "verify";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidUsername(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/.test(value.trim());
}

export function normalizePhoneNumber(value: string) {
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

export function isValidPhoneNumber(value: string) {
  return /^[+\d\s().-]+$/.test(value.trim()) && /^\+[1-9]\d{7,14}$/.test(normalizePhoneNumber(value));
}

/** Convert Supabase's technical messages into guidance a player can act on. */
export function friendlyAuthError(message: string, t: (key: TranslationKey) => string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("email address not authorized")) return t("auth.testMode");
  if (normalizedMessage.includes("email provider") || normalizedMessage.includes("email signups are disabled")) return t("auth.providerDisabled");
  if (normalizedMessage.includes("rate limit")) return t("auth.rateLimit");
  if (normalizedMessage.includes("token") || normalizedMessage.includes("expired")) return t("auth.badCode");
  return message;
}
