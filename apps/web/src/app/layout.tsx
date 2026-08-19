import "@fontsource/epilogue/400.css";
import "@fontsource/epilogue/500.css";
import "@fontsource/epilogue/600.css";
import "@fontsource/epilogue/700.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { LanguageProvider } from "@/components/language-provider";
import { appName } from "@/lib/config";
import { localeDirection } from "@/lib/i18n";
import { getTranslator } from "@/lib/i18n-server";
import "./globals.css";

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
  return (
    <html data-scroll-behavior="smooth" dir={localeDirection(locale)} lang={locale} suppressHydrationWarning>
      <body>
        <LanguageProvider initialLocale={locale}>
          <a className="skip-link" href="#main-content">{t("common.skipContent")}</a>
          <AppShell>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
