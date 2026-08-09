"use client";

import { CalendarDays, CircleUserRound, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CourtMark } from "@/components/court-mark";
import { facilityName } from "@/lib/config";

const links = [
  { href: "/book", label: "Book", icon: CalendarDays },
  { href: "/open-courts", label: "Open Courts", icon: Search },
  { href: "/profile", label: "Profile", icon: CircleUserRound },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  const isBookPage = pathname === "/book";
  const isPublicRoute = pathname === "/" || pathname.startsWith("/auth/");

  return (
    <div className={`site-shell${isPublicRoute ? " site-shell--public" : ""}${isBookPage ? " site-shell--calendar" : ""}`}>
      <header className="site-header">
        <Link className="brand" href="/" aria-label={`${facilityName} home`}>
          <CourtMark compact />
          <span>{facilityName}<small>Reservations</small></span>
        </Link>
        {isLandingPage ? (
          <div className="public-auth-actions">
            <Link className="button button--primary" href="/auth/sign-up">Join</Link>
          </div>
        ) : null}
      </header>

      <div className={isPublicRoute ? "public-frame" : "app-frame"}>
        {!isPublicRoute && <aside className="desktop-rail">
          <nav aria-label="Player navigation">
            {links.map(({ href, label, icon: Icon }) => (
              <Link className={pathname === href ? "is-active" : ""} href={href} key={href}>
                <Icon aria-hidden="true" size={19} />
                {label}
              </Link>
            ))}
          </nav>
          <p>One court. Private bookings and Open Courts for groups that need players.</p>
        </aside>}

        <main id="main-content" className="main-content">{children}</main>
      </div>

      {!isPublicRoute && <nav className="mobile-nav" aria-label="Player navigation">
        {links.map(({ href, label, icon: Icon }) => (
          <Link className={pathname === href ? "is-active" : ""} href={href} key={href}>
            <Icon aria-hidden="true" size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>}

      {isLandingPage && (
        <footer className="site-footer">
          <div>
            <Link className="brand" href="/" aria-label={`${facilityName} home`}><CourtMark compact /><span>{facilityName}<small>Reservations</small></span></Link>
            <p>Book the court, find players, and manage your matches.</p>
          </div>
          <nav aria-label="Footer navigation">
            <Link href="/auth/sign-up">Join</Link>
            <Link href="/auth/sign-in">Sign in</Link>
          </nav>
          <small>© {new Date().getFullYear()} {facilityName}</small>
        </footer>
      )}
    </div>
  );
}
