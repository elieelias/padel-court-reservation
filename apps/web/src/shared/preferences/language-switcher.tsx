"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/shared/preferences/language-provider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className="language-switcher" aria-label={t("language.label")} role="group">
      <Languages aria-hidden="true" size={16} />
      <button aria-pressed={locale === "en"} onClick={() => setLocale("en")} type="button">EN</button>
      <span aria-hidden="true">/</span>
      <button aria-pressed={locale === "ar"} lang="ar" onClick={() => setLocale("ar")} type="button">عربي</button>
    </div>
  );
}
