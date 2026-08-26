import { ProfileSectionNav } from "@/features/profile/components/profile-section-nav";
import { ReportProblemForm } from "@/features/profile/components/report-problem-form";
import { getTranslator } from "@/lib/i18n-server";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("profile.reportProblemTab") };
}

export default async function ReportProblemPage() {
  const { t } = await getTranslator();
  return (
    <div className="page-stack">
      <header className="profile-page-heading"><h1>{t("profile.profileTab")}</h1></header>
      <ProfileSectionNav active="report" />
      <ReportProblemForm />
    </div>
  );
}
