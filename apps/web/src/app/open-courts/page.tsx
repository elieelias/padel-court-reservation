import { PageHeading } from "@/components/page-heading";
import { OpenCourtsBoard } from "@/components/open-courts-board";
import { getTranslator } from "@/lib/i18n-server";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("metadata.openCourts") };
}

export default async function OpenCourtsPage() {
  const { t } = await getTranslator();
  return (
    <div className="page-stack">
      <PageHeading eyebrow={t("openCourts.eyebrow")} title={t("openCourts.title")}>{t("openCourts.description")}</PageHeading>
      <OpenCourtsBoard />
    </div>
  );
}
