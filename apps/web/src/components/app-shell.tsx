"use client";

import { CalendarDays, CircleUserRound, Home, Search, TicketCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CourtMark } from "@/components/court-mark";
import { facilityName } from "@/lib/config";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/book", label: "Book", icon: CalendarDays },
  { href: "/open-courts", label: "Open Courts", icon: Search },
  { href: "/reservations", label: "Reservations", icon: TicketCheck },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label={`${facilityName} home`}>
          <CourtMark compact />
          <span>{facilityName}<small>Reservations</small></span>
        </Link>
        <Link className="account-link" href="/profile">
          <CircleUserRound aria-hidden="true" size={20} />
          <span>Account</span>
        </Link>
      </header>

      <div className="app-frame">
        <aside className="desktop-rail">
          <nav aria-label="Player navigation">
            {links.map(({ href, label, icon: Icon }) => (
              <Link className={pathname === href ? "is-active" : ""} href={href} key={href}>
                <Icon aria-hidden="true" size={19} />
                {label}
              </Link>
            ))}
          </nav>
          <p>One court. Private bookings and Open Courts for groups that need players.</p>
        </aside>

        <main id="main-content" className="main-content">{children}</main>
      </div>

      <nav className="mobile-nav" aria-label="Player navigation">
        {links.map(({ href, label, icon: Icon }) => (
          <Link className={pathname === href ? "is-active" : ""} href={href} key={href}>
            <Icon aria-hidden="true" size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
