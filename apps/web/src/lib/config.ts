export const appName =
  process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Padel One";

export const facilityName =
  process.env.NEXT_PUBLIC_FACILITY_NAME?.trim() || "Padel Court";

export function normalizeFacilityName(value: unknown, fallback = appName) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export const defaultSiteUrl = "https://padel-court-reservation-web.vercel.app";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  defaultSiteUrl
).replace(/\/+$/, "");

export const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const emailVerificationCodeEnabled =
  process.env.NEXT_PUBLIC_EMAIL_VERIFICATION_CODE_ENABLED === "true";

export const defaultCountryCode =
  process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE?.trim() || "+961";
