import { ArrowLeft, LogIn, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { EmailAuthForm } from "@/features/auth/components/email-auth-form";
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
        <div className="auth-switch">
          <span>{t("auth.alreadyRegistered")}</span>
          <Link className="auth-switch__button auth-switch__button--signin" href="/auth/sign-in">
            <LogIn aria-hidden="true" size={18} /> {t("common.signIn")}
          </Link>
        </div>
      </section>
    </div>
  );
}
