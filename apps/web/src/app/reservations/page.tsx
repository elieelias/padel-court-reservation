import { redirect } from "next/navigation";
import { getTranslator } from "@/lib/i18n-server";

export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t("metadata.reservations") };
}

export default function ReservationsPage() {
  redirect("/profile#reservations");
}
