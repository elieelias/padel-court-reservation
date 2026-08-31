import { OpenCourtsBoard } from "@/features/open-courts/components/open-courts-board";
import { PageHeading } from "@/shared/components/page-heading";
import { getTranslator } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("metadata.openCourts") };
}

export default async function OpenCourtsPage() {
  const { t } = await getTranslator();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("facility_settings").select("cancellation_hours").eq("id", 1).single();
  return (
    <div className="page-stack">
      <PageHeading eyebrow={t("openCourts.eyebrow")} title={t("openCourts.title")}>{t("openCourts.description")}</PageHeading>
      <OpenCourtsBoard cancellationHours={settings?.cancellation_hours ?? 2} />
    </div>
  );
}
