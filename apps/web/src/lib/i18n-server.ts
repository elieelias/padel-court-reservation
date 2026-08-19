import { cookies, headers } from "next/headers";
import { isLocale, localeCookieName, translate, type Locale, type TranslationKey } from "@/lib/i18n";

function localeFromAcceptLanguage(value: string | null): Locale {
  if (!value) return "en";

  const preferredLocale = value
    .split(",")
    .map((entry, index) => {
      const [languageTag, ...parameters] = entry.trim().toLowerCase().split(";");
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
      const quality = qualityParameter ? Number.parseFloat(qualityParameter.split("=")[1] ?? "0") : 1;
      const locale = languageTag?.split("-")[0];
      return { index, locale, quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((preference) => isLocale(preference.locale))
    .sort((first, second) => second.quality - first.quality || first.index - second.index)[0]?.locale;

  return isLocale(preferredLocale) ? preferredLocale : "en";
}

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get(localeCookieName)?.value;
  if (isLocale(savedLocale)) return savedLocale;

  const requestHeaders = await headers();
  return localeFromAcceptLanguage(requestHeaders.get("accept-language"));
}

export async function getTranslator() {
  const locale = await getLocale();
  return {
    locale,
    t: (key: TranslationKey, values?: Record<string, string | number>) => translate(locale, key, values),
  };
}
