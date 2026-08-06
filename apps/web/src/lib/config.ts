export const facilityName =
  process.env.NEXT_PUBLIC_FACILITY_NAME?.trim() || "Padel Court";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://padel-court-reservation-web.vercel.app"
).replace(/\/+$/, "");

export const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
