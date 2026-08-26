"use client";

import { CircleUserRound, LogOut, Mail, Pencil, Phone, Save, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LanguageSwitcher } from "@/shared/preferences/language-switcher";
import { ThemeSwitcher } from "@/shared/preferences/theme-switcher";
import { useLanguage } from "@/shared/preferences/language-provider";
import { createClient } from "@/lib/supabase/client";

export type ProfileRow = { username: string; full_name: string | null; phone_number: string | null };
export type ProfileUser = { id: string; email: string | null };

type PlayerProfileProps = {
  enabled: boolean;
  initialUser: ProfileUser | null;
  initialProfile: ProfileRow;
  friendCount: number;
  reservationCount: number;
};

export function PlayerProfile({ enabled, initialUser, initialProfile, friendCount, reservationCount }: PlayerProfileProps) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [username, setUsername] = useState(initialProfile.username ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initialProfile.phone_number ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function saveProfile() {
    if (!initialUser || saving) return;
    const trimmedUsername = username.trim();
    const trimmedPhone = phoneNumber.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/.test(trimmedUsername)) {
      setErrorMessage(t("profile.enterUsername"));
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("update_player_profile", { p_username: trimmedUsername, p_phone_number: trimmedPhone });
    if (error) {
      setErrorMessage(locale === "ar" ? t("profile.updateError") : error.message || t("profile.updateError"));
      setSaving(false);
      return;
    }

    await supabase.auth.updateUser({ data: { username: trimmedUsername, full_name: trimmedUsername } });
    setProfile({ username: trimmedUsername, full_name: trimmedUsername, phone_number: trimmedPhone || null });
    setMessage(t("profile.updated"));
    setEditing(false);
    setSaving(false);
  }

  function cancelEditing() {
    setUsername(profile.username);
    setPhoneNumber(profile.phone_number ?? "");
    setEditing(false);
    setErrorMessage("");
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (!enabled || !initialUser) {
    return (
      <section className="panel player-card player-card--signed-out">
        <CircleUserRound aria-hidden="true" size={50} />
        <h2>{t("profile.signInTitle")}</h2>
        <p>{t("profile.signInDescription")}</p>
        <div className="button-row"><Link className="button button--primary" href="/auth/sign-in">{t("common.signIn")}</Link><Link className="button button--secondary" href="/auth/sign-up">{t("profile.register")}</Link></div>
      </section>
    );
  }

  const displayedName = profile.username || t("profile.player");
  return (
    <div className="player-hub">
      <section className="panel player-card player-card--social">
        <div className="profile-identity">
          <span className="profile-avatar profile-avatar--large"><CircleUserRound aria-hidden="true" size={62} /></span>
          <h2>@{displayedName}</h2>
        </div>

        <div className="profile-stats" aria-label={t("profile.statsLabel")}>
          <Link href="/profile/friends"><strong>{friendCount}</strong><span>{t("profile.friendsStat")}</span></Link>
          <Link href="/profile/history"><strong>{reservationCount}</strong><span>{t("profile.reservationsStat")}</span></Link>
        </div>

        {editing ? (
          <form className="profile-form" onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
            <label>{t("profile.username")}<input autoCapitalize="none" autoComplete="username" maxLength={30} minLength={3} onChange={(event) => setUsername(event.target.value)} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,29}" required type="text" value={username} /></label>
            <label>{t("profile.phone")}<input autoComplete="tel" inputMode="tel" maxLength={24} onChange={(event) => setPhoneNumber(event.target.value)} placeholder={t("profile.phonePlaceholder")} type="tel" value={phoneNumber} /></label>
            <div className="profile-edit-actions">
              <button className="button button--primary" disabled={saving} type="submit"><Save aria-hidden="true" size={17} />{saving ? t("profile.saving") : t("profile.save")}</button>
              <button className="button button--secondary" disabled={saving} onClick={cancelEditing} type="button"><X aria-hidden="true" size={17} />{t("common.cancel")}</button>
            </div>
          </form>
        ) : (
          <>
            <dl className="player-details player-details--readonly">
              <div><dt><Mail aria-hidden="true" size={17} />{t("profile.email")}</dt><dd>{initialUser.email ?? t("profile.notAvailable")}</dd></div>
              <div><dt><Phone aria-hidden="true" size={17} />{t("profile.phone")}</dt><dd>{profile.phone_number || t("profile.notAdded")}</dd></div>
            </dl>
            <div className="profile-preferences">
              <div className="profile-preference-setting"><span>{t("language.label")}</span><LanguageSwitcher /></div>
              <div className="profile-preference-setting"><span>{t("theme.label")}</span><ThemeSwitcher /></div>
            </div>
            <button className="button button--primary edit-profile-button" onClick={() => { setEditing(true); setMessage(""); }} type="button"><Pencil aria-hidden="true" size={17} />{t("profile.editProfile")}</button>
          </>
        )}

        {editing && <div className="profile-preferences">
          <div className="profile-preference-setting"><span>{t("language.label")}</span><LanguageSwitcher /></div>
          <div className="profile-preference-setting"><span>{t("theme.label")}</span><ThemeSwitcher /></div>
        </div>}
        {message && <p className="profile-message" role="status">{message}</p>}
        {errorMessage && <p className="profile-message profile-message--error" role="alert">{errorMessage}</p>}
        <button className="button button--secondary sign-out-button" onClick={() => void signOut()} type="button"><LogOut aria-hidden="true" size={17} />{t("profile.signOut")}</button>
      </section>
    </div>
  );
}
