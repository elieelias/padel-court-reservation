"use client";

import { History, Menu, MessageSquareWarning, UserRound, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/shared/preferences/language-provider";

type ProfileSection = "profile" | "friends" | "history" | "report";

export function ProfileSectionNav({ active }: { active: ProfileSection }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("profile-drawer-open");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("profile-drawer-open");
    };
  }, [open]);

  const items = [
    { id: "profile" as const, href: "/profile", icon: UserRound, label: t("profile.profileTab") },
    { id: "friends" as const, href: "/profile/friends", icon: UsersRound, label: t("profile.friendsTab") },
    { id: "history" as const, href: "/profile/history", icon: History, label: t("profile.historyTab") },
    { id: "report" as const, href: "/profile/report-problem", icon: MessageSquareWarning, label: t("profile.reportProblemTab") },
  ] as const;

  return (
    <>
      <div className="profile-menu-row">
        <button aria-expanded={open} aria-controls="profile-navigation-drawer" className="profile-menu-button" onClick={() => setOpen(true)} type="button">
          <Menu aria-hidden="true" size={19} />
          {t("profile.openMenu")}
        </button>
      </div>

      {open ? (
        <>
          <button aria-label={t("profile.closeMenu")} className="profile-drawer-backdrop is-open" onClick={() => setOpen(false)} type="button" />
          <aside aria-label={t("profile.sectionNavigation")} className="profile-section-drawer is-open" id="profile-navigation-drawer">
            <div className="profile-drawer-heading">
              <strong>{t("profile.menuTitle")}</strong>
              <button aria-label={t("profile.closeMenu")} onClick={() => setOpen(false)} type="button"><X aria-hidden="true" size={20} /></button>
            </div>
            <nav className="profile-section-nav">
              {items.map(({ id, href, icon: Icon, label }) => (
                <Link aria-current={active === id ? "page" : undefined} className={active === id ? "is-active" : ""} href={href} key={id} onClick={() => setOpen(false)}>
                  <Icon aria-hidden="true" size={19} />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </aside>
        </>
      ) : null}
    </>
  );
}
