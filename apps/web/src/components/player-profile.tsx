"use client";

import type { User } from "@supabase/supabase-js";
import { CalendarClock, CircleUserRound, History, LogOut, Mail, Phone, Save, WalletCards } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ProfileRow = { full_name: string | null; phone_number: string | null };
export type ReservationRow = {
  id: string;
  host_id: string;
  start_at: string;
  end_at: string;
  type: "private" | "open";
  status: "pending" | "confirmed" | "completed" | "cancelled" | "expired";
  price: number | string;
  payment_status: "unpaid" | "paid";
};

function reservationDate(startAt: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Beirut",
  }).format(new Date(startAt));
}

function reservationTime(startAt: string, endAt: string) {
  const formatter = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Beirut",
  });
  return `${formatter.format(new Date(startAt))} – ${formatter.format(new Date(endAt))}`;
}

function priceLabel(value: number | string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

type PlayerProfileProps = {
  enabled: boolean;
  initialUser: User | null;
  initialProfile: ProfileRow;
  initialReservations: ReservationRow[];
  initialCancellationHours: number;
};

export function PlayerProfile({ enabled, initialUser, initialProfile, initialReservations, initialCancellationHours }: PlayerProfileProps) {
  const router = useRouter();
  const [user] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<ProfileRow>(initialProfile);
  const [reservations, setReservations] = useState<ReservationRow[]>(initialReservations);
  const [cancellationHours] = useState(initialCancellationHours);
  const [loading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState(initialProfile.full_name ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initialProfile.phone_number ?? "");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function refreshReservations() {
    if (!enabled || !user) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("reservations").select("id, host_id, start_at, end_at, type, status, price, payment_status").order("start_at", { ascending: false });
    if (error) setErrorMessage("Reservations could not be refreshed. Please reload the page.");
    else setReservations((data as ReservationRow[] | null) ?? []);
  }

  const { upcoming, history } = useMemo(() => {
    const future = reservations
      .filter((reservation) => ["pending", "confirmed"].includes(reservation.status) && new Date(reservation.end_at).getTime() > currentTime)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    const previous = reservations
      .filter((reservation) => !future.some((item) => item.id === reservation.id))
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
    return { upcoming: future, history: previous };
  }, [currentTime, reservations]);

  async function saveProfile() {
    if (!user || saving) return;
    const trimmedName = fullName.trim();
    const trimmedPhone = phoneNumber.trim();
    if (!trimmedName) {
      setErrorMessage("Please enter your name.");
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({
      full_name: trimmedName,
      phone_number: trimmedPhone || null,
    }).eq("id", user.id);

    if (error) {
      setErrorMessage(error.message || "Your profile could not be updated.");
      setSaving(false);
      return;
    }

    await supabase.auth.updateUser({ data: { full_name: trimmedName } });
    setProfile({ full_name: trimmedName, phone_number: trimmedPhone || null });
    setMessage("Profile updated.");
    setSaving(false);
  }

  async function cancelReservation(reservation: ReservationRow) {
    if (cancellingId || !window.confirm("Cancel this reservation? This cannot be undone.")) return;
    setCancellingId(reservation.id);
    setMessage("");
    setErrorMessage("");
    const { error } = await createClient().rpc("cancel_reservation", { p_reservation_id: reservation.id });

    if (error) {
      setErrorMessage(error.message || "The reservation could not be cancelled.");
      setCancellingId(null);
      return;
    }

    setMessage("Reservation cancelled.");
    setCancellingId(null);
    await refreshReservations();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  function canCancel(reservation: ReservationRow) {
    if (!user || reservation.host_id !== user.id || !["pending", "confirmed"].includes(reservation.status)) return false;
    return new Date(reservation.start_at).getTime() - currentTime > cancellationHours * 60 * 60 * 1000;
  }

  function ReservationItem({ reservation, upcomingItem = false }: { reservation: ReservationRow; upcomingItem?: boolean }) {
    return (
      <article className="reservation-item">
        <div className="reservation-item__date">
          <strong>{reservationDate(reservation.start_at)}</strong>
          <span>{reservationTime(reservation.start_at, reservation.end_at)}</span>
        </div>
        <div className="reservation-item__chips">
          <span className={`reservation-status reservation-status--${reservation.status}`}>{reservation.status}</span>
          {!upcomingItem && (
            <span className={`payment-status payment-status--${reservation.payment_status}`}><WalletCards aria-hidden="true" size={14} /> Cash {reservation.payment_status}</span>
          )}
        </div>
        <dl className="reservation-item__details">
          <div><dt>Reservation</dt><dd>{reservation.type === "open" ? "Open Court" : "Private court"}</dd></div>
          <div><dt>Price</dt><dd>{priceLabel(reservation.price)}</dd></div>
        </dl>
        {upcomingItem && canCancel(reservation) && (
          <button className="reservation-cancel" disabled={cancellingId === reservation.id} onClick={() => void cancelReservation(reservation)} type="button">
            {cancellingId === reservation.id ? "Cancelling…" : "Cancel reservation"}
          </button>
        )}
      </article>
    );
  }

  const displayedName = profile.full_name || (typeof user?.user_metadata.full_name === "string" ? user.user_metadata.full_name : "Player");

  return (
    <div className="player-hub">
      <section className="panel player-card">
        <span className="profile-avatar"><CircleUserRound aria-hidden="true" size={38} /></span>
        {loading ? (
          <div><span className="eyebrow">Player information</span><h2>Loading profile…</h2></div>
        ) : user ? (
          <>
            <div><span className="eyebrow">Player information</span><h2>{displayedName}</h2></div>
            <dl className="player-details">
              <div><dt><Mail aria-hidden="true" size={17} /> Email address</dt><dd>{user.email ?? "Not available"}</dd></div>
              <div><dt><Phone aria-hidden="true" size={17} /> Phone number</dt><dd>{profile.phone_number || "Not added"}</dd></div>
            </dl>
            <form className="profile-form" onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
              <label>Name<input autoComplete="name" maxLength={100} onChange={(event) => setFullName(event.target.value)} required type="text" value={fullName} /></label>
              <label>Phone number<input autoComplete="tel" inputMode="tel" maxLength={24} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+961" type="tel" value={phoneNumber} /></label>
              <button className="button button--primary" disabled={saving} type="submit"><Save aria-hidden="true" size={17} /> {saving ? "Saving…" : "Save profile"}</button>
            </form>
            {message && <p className="profile-message" role="status">{message}</p>}
            {errorMessage && <p className="profile-message profile-message--error" role="alert">{errorMessage}</p>}
            <button className="button button--secondary sign-out-button" onClick={() => void signOut()} type="button"><LogOut aria-hidden="true" size={17} /> Sign out</button>
          </>
        ) : (
          <>
            <div><span className="eyebrow">Player information</span><h2>Sign in to view your profile</h2></div>
            <p>Your player details and reservations will appear here after you sign in.</p>
            <div className="button-row"><Link className="button button--primary" href="/auth/sign-in">Sign in</Link><Link className="button button--secondary" href="/auth/sign-up">Register</Link></div>
          </>
        )}
      </section>

      <div className="reservation-sections" id="reservations">
        <section className="panel reservation-list-card">
          <div className="section-heading"><div><span className="eyebrow">Upcoming</span><h2>Upcoming reservations</h2></div><CalendarClock aria-hidden="true" size={25} /></div>
          {upcoming.length ? <div className="reservation-list">{upcoming.map((reservation) => <ReservationItem key={reservation.id} reservation={reservation} upcomingItem />)}</div> : <div className="empty-reservation"><strong>No upcoming reservations</strong><span>Your next confirmed booking will appear here.</span><Link className="text-link" href="/book">Book a court</Link></div>}
        </section>
        <section className="panel reservation-list-card">
          <div className="section-heading"><div><span className="eyebrow">Previous matches</span><h2>Reservation history</h2></div><History aria-hidden="true" size={25} /></div>
          {history.length ? <div className="reservation-list">{history.map((reservation) => <ReservationItem key={reservation.id} reservation={reservation} />)}</div> : <div className="empty-reservation"><strong>No reservation history</strong><span>Completed and cancelled reservations will appear here.</span></div>}
        </section>
      </div>
    </div>
  );
}
