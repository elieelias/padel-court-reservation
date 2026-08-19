import { ArrowLeft, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { EmailAuthForm } from "@/components/email-auth-form";
import { emailVerificationCodeEnabled, hasSupabaseConfig } from "@/lib/config";
import { getTranslator } from "@/lib/i18n-server";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("metadata.signUp") };
}

export default async function SignUpPage() {
  const { t } = await getTranslator();
  return (
    <div className="auth-wrap">
      <Link className="back-link" href="/"><ArrowLeft className="directional-icon" aria-hidden="true" size={18} /> {t("auth.backHome")}</Link>
      <section className="auth-card">
        <span className="auth-icon"><UserRoundPlus aria-hidden="true" size={26} /></span>
        <span className="eyebrow">{t("auth.newPlayer")}</span>
        <h1>{t("auth.createTitle")}</h1>
        <p>{emailVerificationCodeEnabled ? t("auth.signUpCodeIntro") : t("auth.signUpLinkIntro")}</p>
        <EmailAuthForm enabled={hasSupabaseConfig} mode="sign-up" />
        <p className="auth-switch">{t("auth.alreadyRegistered")} <Link href="/auth/sign-in">{t("common.signIn")}</Link></p>
      </section>
    </div>
  );
}
