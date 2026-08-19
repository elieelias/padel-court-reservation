import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HeroCourtSimulation } from "@/components/hero-court-simulation";
import { getTranslator } from "@/lib/i18n-server";

export default async function HomePage() {
  const { t } = await getTranslator();
  return (
    <div className="landing-page">
      <section className="hero landing-hero">
        <div className="hero__copy">
          <h1>{t("landing.titleLine1")}<br />{t("landing.titleLine2")}</h1>
          <p>{t("landing.description")}</p>
          <div className="button-row">
            <Link className="button button--primary" href="/auth/sign-up">{t("landing.joinBook")} <ArrowRight className="directional-icon" aria-hidden="true" size={18} /></Link>
            <Link className="button button--secondary" href="/auth/sign-in">{t("common.signIn")}</Link>
          </div>
        </div>
        <HeroCourtSimulation />
      </section>

      <section className="steps-section landing-steps">
        <div><h2>{t("landing.stepsTitle")}</h2><p>{t("landing.stepsDescription")}</p></div>
        <ol className="steps-list">
          <li><strong>01</strong><span><b>{t("landing.step1Title")}</b>{t("landing.step1Text")}</span></li>
          <li><strong>02</strong><span><b>{t("landing.step2Title")}</b>{t("landing.step2Text")}</span></li>
          <li><strong>03</strong><span><b>{t("landing.step3Title")}</b>{t("landing.step3Text")}</span></li>
        </ol>
      </section>
    </div>
  );
}
