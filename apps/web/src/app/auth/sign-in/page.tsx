import { ArrowLeft, LockKeyhole, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { EmailAuthForm } from "@/components/email-auth-form";
import { emailVerificationCodeEnabled, hasSupabaseConfig } from "@/lib/config";
import { getTranslator } from "@/lib/i18n-server";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("metadata.signIn") };
}

const authErrorMessageKeys = {
  "invalid-link": "auth.invalidLink",
  "missing-code": "auth.missingCode",
  "missing-config": "auth.missingConfig",
} as const;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { t } = await getTranslator();
  const errorKey = error ? authErrorMessageKeys[error as keyof typeof authErrorMessageKeys] : undefined;
  const errorMessage = errorKey ? t(errorKey) : undefined;

  return (
    <div className="auth-wrap">
      <Link className="back-link" href="/"><ArrowLeft className="directional-icon" aria-hidden="true" size={18} /> {t("auth.backHome")}</Link>
      <section className="auth-card">
        <span className="auth-icon"><LockKeyhole aria-hidden="true" size={26} /></span>
        <span className="eyebrow">{t("auth.playerAccess")}</span>
        <h1>{t("auth.signInTitle")}</h1>
        <p>{emailVerificationCodeEnabled ? t("auth.signInCodeIntro") : t("auth.signInLinkIntro")}</p>
        {errorMessage ? <p className="form-message" role="alert">{errorMessage}</p> : null}
        <EmailAuthForm enabled={hasSupabaseConfig} mode="sign-in" />
        <div className="auth-switch">
          <span>{t("auth.newPlayerQuestion")}</span>
          <Link className="auth-switch__button auth-switch__button--signup" href="/auth/sign-up">
            <UserRoundPlus aria-hidden="true" size={18} /> {t("auth.createAccount")}
          </Link>
        </div>
      </section>
    </div>
  );
}
