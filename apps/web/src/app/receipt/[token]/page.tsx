// Opens a safe public verification page when a reservation QR code is scanned by a phone camera.

import { CalendarClock, CheckCircle2, ShieldCheck } from 'lucide-react';

import { createClient } from '@supabase/supabase-js';

export const metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};

type ReceiptRow = {
  end_at: string;
  facility_name: string;
  reservation_status: string;
  reservation_type: string;
  start_at: string;
};

export default async function ReceiptVerificationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const validToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
  // This page deliberately uses only the public key, never a player's session.
  // The receipt RPC exposes court/time/status, not private player/payment data.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const result = validToken
    ? await supabase.rpc('lookup_reservation_receipt', { p_pass_token: token }).maybeSingle()
    : { data: null, error: null };
  const receipt = result.data as ReceiptRow | null;

  return (
    <div className="receipt-verification">
      <section className="receipt-verification__card">
        <div className="receipt-verification__mark"><ShieldCheck aria-hidden="true" size={26} /></div>
        {receipt ? (
          <>
            <span className="receipt-verification__eyebrow">Reservation receipt</span>
            <h1>Receipt verified</h1>
            <p>This QR code matches a reservation stored by {receipt.facility_name}.</p>
            <dl>
              <div><dt>Date</dt><dd>{formatDate(receipt.start_at)}</dd></div>
              <div><dt>Time</dt><dd>{formatTime(receipt.start_at, receipt.end_at)}</dd></div>
              <div><dt>Reservation</dt><dd>{titleCase(receipt.reservation_type)}</dd></div>
              <div><dt>Status</dt><dd>{titleCase(receipt.reservation_status)}</dd></div>
            </dl>
            <div className="receipt-verification__notice"><CheckCircle2 aria-hidden="true" size={18} />Open the administrator app to view protected player and payment details.</div>
          </>
        ) : (
          <>
            <span className="receipt-verification__eyebrow">Reservation receipt</span>
            <h1>Receipt not found</h1>
            <p>This QR code does not match a reservation. Ask the player to open the latest receipt from their account.</p>
            <div className="receipt-verification__notice"><CalendarClock aria-hidden="true" size={18} />You can also enter the backup code in the administrator app.</div>
          </>
        )}
      </section>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', timeZone: 'Asia/Beirut', weekday: 'long', year: 'numeric' }).format(new Date(value));
}

function formatTime(startAt: string, endAt: string) {
  const formatter = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Beirut' });
  return `${formatter.format(new Date(startAt))} – ${formatter.format(new Date(endAt))}`;
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
