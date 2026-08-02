export const facilityName =
  process.env.NEXT_PUBLIC_FACILITY_NAME?.trim() || "Padel Court";

export const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
