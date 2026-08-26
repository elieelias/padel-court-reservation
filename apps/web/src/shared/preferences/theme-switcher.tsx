"use client";

import { Moon, Sun } from "lucide-react";
import { useLanguage } from "@/shared/preferences/language-provider";
import { useTheme } from "@/shared/preferences/theme-provider";

export function ThemeSwitcher() {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <div aria-label={t("theme.label")} className="theme-switcher" role="group">
      <button aria-label={t("theme.light")} aria-pressed={theme === "light"} onClick={() => setTheme("light")} type="button"><Sun aria-hidden="true" size={16} /><span>{t("theme.light")}</span></button>
      <button aria-label={t("theme.dark")} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")} type="button"><Moon aria-hidden="true" size={16} /><span>{t("theme.dark")}</span></button>
    </div>
  );
}
