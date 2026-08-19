"use client";

import { Cable, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

export function SetupState({ context }: { context: "availability" | "open-courts" | "reservations" }) {
  const { t } = useLanguage();
  const copy = {
    availability: {
      title: t("setup.availabilityTitle"),
      text: t("setup.availabilityText"),
    },
    "open-courts": {
      title: t("setup.openTitle"),
      text: t("setup.openText"),
    },
    reservations: {
      title: t("setup.reservationsTitle"),
      text: t("setup.reservationsText"),
    },
  }[context];

  return (
    <section className="setup-state">
      <span className="setup-state__icon"><Cable aria-hidden="true" size={28} /></span>
      <div>
        <span className="status-chip"><CheckCircle2 aria-hidden="true" size={15} /> {t("setup.ready")}</span>
        <h2>{copy.title}</h2>
        <p>{copy.text}</p>
      </div>
      <Link className="button button--secondary" href="/profile">{t("setup.account")}</Link>
    </section>
  );
}
