import { CalendarOff, ChevronRight, Megaphone, Trophy, UsersRound, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { intlLocale, type Locale, type TranslationKey } from "@/lib/i18n";
import { getTranslator } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

type FacilityEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: "tournament" | "community" | "announcement";
  start_at: string;
  end_at: string;
};
type BlockedPeriod = { id: string; start_at: string; end_at: string; reason: string | null };
type TimelineEvent = {
  id: string;
  title: string;
  description: string | null;
  type: FacilityEvent["event_type"] | "closure";
  startAt: string;
  endAt: string;
};

const eventIcons: Record<TimelineEvent["type"], LucideIcon> = {
  tournament: Trophy,
  community: UsersRound,
  announcement: Megaphone,
  closure: CalendarOff,
};

function eventDate(value: string, locale: Locale) {
  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", timeZone: "Asia/Beirut" }).format(date),
    month: new Intl.DateTimeFormat(intlLocale(locale), { month: "short", timeZone: "Asia/Beirut" }).format(date),
    full: new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Beirut" }).format(date),
  };
}

function eventTime(startAt: string, endAt: string, locale: Locale) {
  const formatter = new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit", timeZone: "Asia/Beirut" });
  return `${formatter.format(new Date(startAt))} – ${formatter.format(new Date(endAt))}`;
}

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("metadata.events") };
}

export default async function EventsPage() {
  const { locale, t } = await getTranslator();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [eventsResult, blockedResult] = await Promise.all([
    supabase.from("facility_events").select("id, title, description, event_type, start_at, end_at").gt("end_at", now).order("start_at"),
    supabase.from("blocked_periods").select("id, start_at, end_at, reason").gt("end_at", now).order("start_at"),
  ]);

  const events: TimelineEvent[] = [
    ...(((eventsResult.data as FacilityEvent[] | null) ?? []).map((event) => ({ id: `event-${event.id}`, title: event.title, description: event.description, type: event.event_type, startAt: event.start_at, endAt: event.end_at }))),
    ...(((blockedResult.data as BlockedPeriod[] | null) ?? []).map((period) => ({ id: `blocked-${period.id}`, title: period.reason || t("events.closure"), description: period.reason ? t("events.closed") : null, type: "closure" as const, startAt: period.start_at, endAt: period.end_at }))),
  ].sort((first, second) => first.startAt.localeCompare(second.startAt));

  return (
    <div className="page-stack events-page">
      <PageHeading eyebrow={t("events.eyebrow")} title={t("events.title")}>{t("events.description")}</PageHeading>
      <section className="events-panel" aria-labelledby="upcoming-events-heading">
        <h2 id="upcoming-events-heading">{t("events.upcoming")}</h2>
        {events.length ? <div className="events-timeline">{events.map((event) => {
          const Icon = eventIcons[event.type];
          const date = eventDate(event.startAt, locale);
          return (
            <Link className={`event-card event-card--${event.type}`} href={`/events/${event.id}` as Route} key={event.id}>
              <time className="event-card__date" dateTime={event.startAt}><strong>{date.day}</strong><span>{date.month}</span></time>
              <span className="event-card__icon"><Icon aria-hidden="true" size={20} /></span>
              <div className="event-card__body">
                <span className="event-card__type">{t(`events.${event.type}` as TranslationKey)}</span>
                <h3>{event.title}</h3>
                <time dateTime={event.startAt}>{date.full} · {eventTime(event.startAt, event.endAt, locale)}</time>
                {event.description && <p>{event.description}</p>}
              </div>
              <span className="event-card__view">{t("events.viewDetails")} <ChevronRight className="directional-icon" aria-hidden="true" size={16} /></span>
            </Link>
          );
        })}</div> : <div className="events-empty"><CalendarOff aria-hidden="true" size={26} /><strong>{t("events.noEvents")}</strong><span>{t("events.noEventsText")}</span></div>}
      </section>
    </div>
  );
}
