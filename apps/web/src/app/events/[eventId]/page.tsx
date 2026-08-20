import { ArrowLeft, CalendarOff, Megaphone, Trophy, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { intlLocale, type Locale, type TranslationKey } from "@/lib/i18n";
import { getTranslator } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

type EventType = "tournament" | "community" | "announcement" | "closure";
type EventDetail = {
  title: string;
  description: string | null;
  type: EventType;
  startAt: string;
  endAt: string;
};

const eventIcons: Record<EventType, LucideIcon> = {
  tournament: Trophy,
  community: UsersRound,
  announcement: Megaphone,
  closure: CalendarOff,
};

function dateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Beirut",
  }).format(new Date(value));
}

function eventIdentifier(value: string) {
  const match = /^(event|blocked)-([0-9a-f-]{36})$/i.exec(value);
  return match ? { kind: match[1], id: match[2] } : null;
}

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const identifier = eventIdentifier(eventId);
  if (!identifier) notFound();

  const { locale, t } = await getTranslator();
  const supabase = await createClient();
  let event: EventDetail | null = null;

  if (identifier.kind === "event") {
    const { data, error } = await supabase
      .from("facility_events")
      .select("title, description, event_type, start_at, end_at")
      .eq("id", identifier.id)
      .maybeSingle();
    if (error || !data) notFound();
    event = {
      title: data.title,
      description: data.description,
      type: data.event_type as Exclude<EventType, "closure">,
      startAt: data.start_at,
      endAt: data.end_at,
    };
  } else {
    const { data, error } = await supabase
      .from("blocked_periods")
      .select("reason, start_at, end_at")
      .eq("id", identifier.id)
      .maybeSingle();
    if (error || !data) notFound();
    event = {
      title: data.reason || t("events.closure"),
      description: data.reason ? t("events.closed") : null,
      type: "closure",
      startAt: data.start_at,
      endAt: data.end_at,
    };
  }

  const Icon = eventIcons[event.type];
  return (
    <div className={`page-stack events-page event-detail event-detail--${event.type}`}>
      <Link className="back-link event-detail__back" href="/events">
        <ArrowLeft className="directional-icon" aria-hidden="true" size={18} /> {t("events.back")}
      </Link>
      <article className="event-detail__card">
        <header className="event-detail__heading">
          <span className="event-detail__icon"><Icon aria-hidden="true" size={25} /></span>
          <div>
            <span>{t(`events.${event.type}` as TranslationKey)} · {t("events.details")}</span>
            <h1>{event.title}</h1>
          </div>
        </header>
        <dl className="event-detail__schedule">
          <div><dt>{t("events.starts")}</dt><dd>{dateTime(event.startAt, locale)}</dd></div>
          <div><dt>{t("events.ends")}</dt><dd>{dateTime(event.endAt, locale)}</dd></div>
        </dl>
        {event.description ? <p className="event-detail__description">{event.description}</p> : null}
        {event.type === "closure" ? <p className="event-detail__notice">{t("events.closureNotice")}</p> : null}
      </article>
    </div>
  );
}
