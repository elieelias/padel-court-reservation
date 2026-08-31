"use client";

import { CalendarDays, CalendarRange, CircleUserRound, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NotificationCenter } from "@/features/notifications/components/notification-center";
import { CourtMark } from "@/shared/components/court-mark";
import { useLanguage } from "@/shared/preferences/language-provider";
import { appName } from "@/lib/config";
import { isPublicPath } from "@/lib/route-access";

const links = [
  { href: "/book", labelKey: "common.book", icon: CalendarDays },
  { href: "/open-courts", labelKey: "common.openCourts", icon: Search },
  { href: "/events", labelKey: "common.events", icon: CalendarRange },
  { href: "/profile", labelKey: "common.profile", icon: CircleUserRound },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  const isBookPage = pathname === "/book";
  const isProfilePage = pathname === "/profile" || pathname.startsWith("/profile/");
  const isPublicRoute = isPublicPath(pathname);

  return (
    <div className={`site-shell${isPublicRoute ? " site-shell--public" : ""}${isBookPage ? " site-shell--calendar" : ""}${isProfilePage ? " site-shell--profile" : ""}`}>
      <header className="site-header">
        <Link className="brand" href="/" aria-label={`${appName} ${t("common.home")}`}>
          <CourtMark compact />
          <span>{appName}</span>
        </Link>
        <div className="header-actions">
          {isLandingPage ? <Link className="button button--primary" href="/auth/sign-up">{t("common.join")}</Link> : null}
          {!isPublicRoute ? <NotificationCenter /> : null}
        </div>
      </header>

      <div className={isPublicRoute ? "public-frame" : "app-frame"}>
        {!isPublicRoute && <aside className="desktop-rail">
          <nav aria-label={t("common.playerNavigation")}>
            {links.map(({ href, labelKey, icon: Icon }) => (
              <Link className={pathname === href || (href === "/profile" && pathname.startsWith("/profile/")) ? "is-active" : ""} href={href} key={href}>
                <Icon aria-hidden="true" size={19} />
                {t(labelKey)}
              </Link>
            ))}
          </nav>
          <p>{t("shell.rail")}</p>
        </aside>}

        <main id="main-content" className="main-content">{children}</main>
      </div>

      {!isPublicRoute && <nav className="mobile-nav" aria-label={t("common.playerNavigation")}>
        {links.map(({ href, labelKey, icon: Icon }) => (
          <Link className={pathname === href || (href === "/profile" && pathname.startsWith("/profile/")) ? "is-active" : ""} href={href} key={href}>
            <Icon aria-hidden="true" size={20} />
            <span>{t(labelKey)}</span>
          </Link>
        ))}
      </nav>}

      {isLandingPage && (
        <footer className="site-footer">
          <div>
            <Link className="brand" href="/" aria-label={`${appName} ${t("common.home")}`}><CourtMark compact /><span>{appName}</span></Link>
          </div>
          <nav aria-label={t("common.footerNavigation")}>
            <Link href="/auth/sign-up">{t("common.join")}</Link>
            <Link href="/auth/sign-in">{t("common.signIn")}</Link>
          </nav>
          <small>© {new Date().getFullYear()} {appName}</small>
        </footer>
      )}
    </div>
  );
}
