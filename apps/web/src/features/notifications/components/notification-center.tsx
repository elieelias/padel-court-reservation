"use client";

import { BadgePercent, Bell, CalendarDays, CheckCheck, ListOrdered, MailCheck, UserRoundPlus, UsersRound, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/shared/preferences/language-provider";
import { intlLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  notification_id: string;
  event_type: string;
  created_at: string;
  read_at: string | null;
  reservation_id: string | null;
  friendship_id: string | null;
  join_request_id: string | null;
  actor_username: string | null;
  reservation_start_at: string | null;
  reservation_end_at: string | null;
};

type NotificationTarget = "/profile/friends" | "/open-courts" | `/open-courts/${string}` | "/profile/history" | "/book" | "/book#upcoming-reservations" | "/book#reservation-invitations" | "/events";

export function NotificationCenter() {
  const { locale, t } = useLanguage();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const { data } = await createClient().rpc("list_player_notifications");
    if (data) setItems(data as NotificationRow[]);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      if (data.user) void refresh();
    });
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`player-notifications-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void refresh())
      .subscribe();
    const interval = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  async function markRead(ids?: string[]) {
    await createClient().rpc("mark_notifications_read", { p_notification_ids: ids?.length ? ids : null });
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => (!ids || ids.includes(item.notification_id)) ? { ...item, read_at: item.read_at ?? readAt } : item));
  }

  function details(item: NotificationRow): { icon: typeof CalendarDays; text: string; href: NotificationTarget } {
    const name = item.actor_username ? `@${item.actor_username}` : t("notifications.aPlayer");
    const isFriend = Boolean(item.friendship_id);
    if (item.event_type === "discount_announcement") return { icon: BadgePercent, text: t("notifications.discountAnnouncement"), href: "/events" };
    if (isFriend && item.event_type === "join_request_created") return { icon: UserRoundPlus, text: t("notifications.friendRequest", { name }), href: "/profile/friends" };
    if (isFriend && item.event_type === "join_request_accepted") return { icon: UsersRound, text: t("notifications.friendAccepted", { name }), href: "/profile/friends" };
    if (isFriend && item.event_type === "join_request_rejected") return { icon: UsersRound, text: t("notifications.friendDeclined", { name }), href: "/profile/friends" };
    if (item.event_type === "reservation_invitation") return { icon: MailCheck, text: t("notifications.reservationInvitation", { name }), href: "/book#reservation-invitations" };
    if (item.event_type === "reservation_invitation_accepted") return { icon: UsersRound, text: t("notifications.invitationAccepted", { name }), href: "/book#reservation-invitations" };
    if (item.event_type === "reservation_invitation_declined") return { icon: UsersRound, text: t("notifications.invitationDeclined", { name }), href: "/book#reservation-invitations" };
    if (item.event_type === "waitlist_joined") return { icon: ListOrdered, text: t("notifications.waitlistJoined", { name }), href: "/book#upcoming-reservations" };
    if (item.event_type === "waitlist_added") return { icon: ListOrdered, text: t("notifications.waitlistAdded"), href: "/open-courts" };
    if (item.event_type === "waitlist_promoted") return { icon: ListOrdered, text: t("notifications.waitlistPromoted"), href: "/book#upcoming-reservations" };
    if (item.event_type === "court_available") return { icon: CalendarDays, text: t("notifications.courtAvailable"), href: "/book" };
    if (item.event_type === "join_request_created") return { icon: UserRoundPlus, text: t("notifications.openCourtRequest", { name }), href: "/open-courts" };
    if (item.event_type === "join_request_accepted") return { icon: UsersRound, text: t("notifications.openCourtAccepted"), href: "/open-courts" };
    if (item.event_type === "join_request_rejected") return { icon: UsersRound, text: t("notifications.openCourtDeclined"), href: "/open-courts" };
    if (item.event_type === "participant_removed") return { icon: UsersRound, text: t("notifications.openCourtPlayerLeft", { name }), href: item.reservation_id ? `/open-courts/${item.reservation_id}` : "/open-courts" };
    if (item.event_type === "reservation_cancellation" && item.join_request_id) return { icon: UsersRound, text: t("notifications.openCourtRemoved"), href: "/open-courts" };
    if (item.event_type === "reservation_cancellation" || item.event_type === "open_court_auto_cancelled") return { icon: CalendarDays, text: t("notifications.reservationCancelled"), href: "/profile/history" };
    return { icon: CalendarDays, text: t("notifications.reservationConfirmed"), href: "/book#upcoming-reservations" };
  }

  function formatTime(item: NotificationRow) {
    if (!item.reservation_start_at) return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at));
    return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.reservation_start_at));
  }

  if (!userId) return null;

  return (
    <div className="notification-center" ref={rootRef}>
      <button aria-expanded={open} aria-label={t("notifications.title")} className="notification-bell" onClick={() => setOpen((value) => !value)} type="button">
        <Bell aria-hidden="true" size={20} />
        {unreadCount > 0 && <span>{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && (
        <section aria-label={t("notifications.title")} className="notification-panel">
          <header>
            <div><strong>{t("notifications.title")}</strong><small>{unreadCount ? t("notifications.unread", { count: unreadCount }) : t("notifications.caughtUp")}</small></div>
            <button aria-label={t("common.close")} className="notification-panel__close" onClick={() => setOpen(false)} type="button"><X aria-hidden="true" size={18} /></button>
          </header>
          {unreadCount > 0 && <button className="notification-mark-all" onClick={() => void markRead()} type="button"><CheckCheck aria-hidden="true" size={16} />{t("notifications.markAll")}</button>}
          <div className="notification-list">
            {items.length ? items.map((item) => {
              const detail = details(item);
              const Icon = detail.icon;
              return (
                <Link className={item.read_at ? "notification-item" : "notification-item is-unread"} href={detail.href as Route} key={item.notification_id} onClick={() => { void markRead([item.notification_id]); setOpen(false); }}>
                  <span className="notification-item__icon"><Icon aria-hidden="true" size={18} /></span>
                  <span><strong>{detail.text}</strong><small>{formatTime(item)}</small></span>
                  {!item.read_at && <i aria-hidden="true" />}
                </Link>
              );
            }) : <p className="notification-empty">{t("notifications.empty")}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
