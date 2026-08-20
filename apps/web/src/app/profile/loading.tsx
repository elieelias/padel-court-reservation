import { CircleUserRound } from "lucide-react";

export default function ProfileLoading() {
  return (
    <div className="page-stack profile-page-stack profile-loading" aria-busy="true">
      <div className="profile-loading__title" />
      <div className="profile-loading__menu" />
      <section className="panel player-card player-card--social profile-loading__card">
        <span className="profile-avatar profile-avatar--large"><CircleUserRound aria-hidden="true" size={56} /></span>
        <span className="profile-loading__name" />
        <span className="profile-loading__line" />
        <span className="profile-loading__line" />
        <span className="profile-loading__line profile-loading__line--short" />
      </section>
    </div>
  );
}
