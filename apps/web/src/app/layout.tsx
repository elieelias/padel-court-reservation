import "@fontsource/epilogue/400.css";
import "@fontsource/epilogue/500.css";
import "@fontsource/epilogue/600.css";
import "@fontsource/epilogue/700.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/shared/layout/app-shell";
import { LanguageProvider } from "@/shared/preferences/language-provider";
import { ThemeProvider, type Theme } from "@/shared/preferences/theme-provider";
import { appName } from "@/lib/config";
import { localeDirection } from "@/lib/i18n";
import { getTranslator } from "@/lib/i18n-server";
import "@/stylesheets/app.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return {
    title: {
      default: `${appName} · ${t("common.reservations")}`,
      template: `%s · ${appName}`,
    },
    description: t("metadata.description"),
  };
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { locale, t } = await getTranslator();
  const themeCookie = (await cookies()).get("padel_theme")?.value;
  const initialTheme: Theme = themeCookie === "dark" ? "dark" : "light";
  return (
    <html data-scroll-behavior="smooth" data-theme={initialTheme} dir={localeDirection(locale)} lang={locale} suppressHydrationWarning>
      <body>
        <ThemeProvider initialTheme={initialTheme}>
          <LanguageProvider initialLocale={locale}>
            <a className="skip-link" href="#main-content">{t("common.skipContent")}</a>
            <AppShell>{children}</AppShell>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
