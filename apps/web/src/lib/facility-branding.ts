import { cache } from "react";
import { appName, hasSupabaseConfig, normalizeFacilityName } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

/** Reads the admin-managed public brand name for server-rendered pages. */
export const getFacilityBrandName = cache(async () => {
  if (!hasSupabaseConfig) return appName;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("facility_settings")
      .select("facility_name")
      .limit(1)
      .maybeSingle();

    if (error) return appName;
    return normalizeFacilityName(data?.facility_name);
  } catch {
    return appName;
  }
});
