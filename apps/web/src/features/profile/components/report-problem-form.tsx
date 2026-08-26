"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/shared/preferences/language-provider";
import { createClient } from "@/lib/supabase/client";

export function ReportProblemForm() {
  const { locale, t } = useLanguage();
  const [category, setCategory] = useState("booking");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDetails = details.trim();
    if (trimmedDetails.length < 10 || submitting) return;

    setSubmitting(true);
    setMessage("");
    setErrorMessage("");

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setErrorMessage(t("profile.reportSignIn"));
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("player_issue_reports").insert({
      player_id: userData.user.id,
      category,
      details: trimmedDetails,
      page_path: window.location.pathname,
      locale,
    });

    if (error) {
      setErrorMessage(t("profile.reportError"));
    } else {
      setDetails("");
      setMessage(t("profile.reportSuccess"));
    }
    setSubmitting(false);
  }

  return (
    <section className="panel report-problem-card">
      <h2>{t("profile.reportProblemTitle")}</h2>
      <p>{t("profile.reportProblemDescription")}</p>
      <form className="report-problem-form" onSubmit={(event) => void submitReport(event)}>
        <label>
          {t("profile.reportCategory")}
          <select onChange={(event) => setCategory(event.target.value)} value={category}>
            <option value="booking">{t("profile.reportCategoryBooking")}</option>
            <option value="account">{t("profile.reportCategoryAccount")}</option>
            <option value="payment">{t("profile.reportCategoryPayment")}</option>
            <option value="other">{t("profile.reportCategoryOther")}</option>
          </select>
        </label>
        <label>
          {t("profile.reportDetails")}
          <textarea maxLength={2000} minLength={10} onChange={(event) => setDetails(event.target.value)} placeholder={t("profile.reportDetailsPlaceholder")} required rows={6} value={details} />
        </label>
        <button className="button button--primary" disabled={submitting || details.trim().length < 10} type="submit">
          <Send aria-hidden="true" size={17} />
          {submitting ? t("profile.reportSubmitting") : t("profile.reportSubmit")}
        </button>
      </form>
      {message && <p className="profile-message" role="status">{message}</p>}
      {errorMessage && <p className="profile-message profile-message--error" role="alert">{errorMessage}</p>}
    </section>
  );
}
