"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { normalizeFacilityName } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

type FacilityContextValue = {
  facilityName: string;
};

const FacilityContext = createContext<FacilityContextValue | null>(null);

/** Keeps branding current after an administrator changes the facility name. */
export function FacilityProvider({ children, initialName }: { children: ReactNode; initialName: string }) {
  const [facilityName, setFacilityName] = useState(() => normalizeFacilityName(initialName));

  const refreshName = useCallback(async () => {
    try {
      const { data, error } = await createClient()
        .from("facility_settings")
        .select("facility_name")
        .limit(1)
        .maybeSingle();
      if (!error) setFacilityName((current) => normalizeFacilityName(data?.facility_name, current));
    } catch {
      // Keep the last known name if the browser is temporarily offline.
    }
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshName();
    };
    const timer = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [refreshName]);

  const value = useMemo(() => ({ facilityName }), [facilityName]);
  return <FacilityContext.Provider value={value}>{children}</FacilityContext.Provider>;
}

export function useFacilityBrand() {
  const context = useContext(FacilityContext);
  if (!context) throw new Error("useFacilityBrand must be used inside FacilityProvider.");
  return context;
}
