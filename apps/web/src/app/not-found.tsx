import Link from "next/link";
import { getTranslator } from "@/lib/i18n-server";

export default async function NotFound() {
  const { t } = await getTranslator();
  return <section className="not-found"><span className="eyebrow">404</span><h1>{t("notFound.title")}</h1><Link className="button button--primary" href="/">{t("notFound.home")}</Link></section>;
}
