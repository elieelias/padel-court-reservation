import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

type OutboxItem = {
  id: string;
  notification_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  event_type: string;
  event_key: string | null;
  context_type: string | null;
  actor_username: string | null;
  reservation_start_at: string | null;
  reservation_end_at: string | null;
  attempts: number;
};

const jsonHeaders = { "Content-Type": "application/json" };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reservationTime(item: OutboxItem, timeZone: string) {
  if (!item.reservation_start_at) return null;
  const date = new Intl.DateTimeFormat("en", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(item.reservation_start_at));
  const formatter = new Intl.DateTimeFormat("en", { timeZone, hour: "numeric", minute: "2-digit" });
  const start = formatter.format(new Date(item.reservation_start_at));
  const end = item.reservation_end_at ? formatter.format(new Date(item.reservation_end_at)) : null;
  return `${date} at ${start}${end ? `–${end}` : ""}`;
}

function messageFor(item: OutboxItem) {
  const actor = item.actor_username ? `@${item.actor_username}` : "A player";
  const key = item.event_key || item.event_type;

  if (item.context_type === "administrator_account") {
    return {
      subject: item.event_type === "administrator_account_created" ? "New administrator account" : "New player account",
      heading: "A new account was created",
      body: `${actor} has created a new account. You can review it in the administrator app.`,
    };
  }
  if (item.context_type === "friendship") {
    if (item.event_type === "join_request_accepted") return { subject: "Friend request accepted", heading: "You are now friends", body: `${actor} accepted your friend request.` };
    if (item.event_type === "join_request_rejected") return { subject: "Friend request update", heading: "Friend request declined", body: `${actor} declined your friend request.` };
    return { subject: "New friend request", heading: "You have a friend request", body: `${actor} sent you a friend request.` };
  }
  if (item.context_type === "open_court_request") {
    if (item.event_type === "join_request_accepted") return { subject: "Court request accepted", heading: "You are joining the court", body: `${actor} accepted your request to join an open court.` };
    if (item.event_type === "join_request_rejected") return { subject: "Court request update", heading: "Join request declined", body: `${actor} declined your request to join an open court.` };
    return { subject: "New court join request", heading: "A player wants to join", body: `${actor} requested to join your open court.` };
  }

  const messages: Record<string, { subject: string; heading: string; body: string }> = {
    reservation_confirmation: { subject: "Reservation confirmed", heading: "Your court is confirmed", body: "Your padel court reservation has been confirmed." },
    reservation_cancellation: { subject: "Reservation cancelled", heading: "Reservation cancelled", body: "A padel court reservation was cancelled." },
    reservation_reminder: { subject: "Upcoming padel reservation", heading: "Your court is coming up", body: "This is a reminder for your upcoming padel court reservation." },
    participant_removed: { subject: "Reservation participant update", heading: "Your reservation changed", body: "You are no longer listed as a participant in this reservation." },
    open_court_auto_cancelled: { subject: "Open court cancelled", heading: "Open court cancelled", body: "The open court was cancelled because it did not have enough confirmed players." },
    reservation_invitation: { subject: "Padel reservation invitation", heading: "You are invited to play", body: `${actor} invited you to a private padel reservation.` },
    reservation_invitation_accepted: { subject: "Reservation invitation accepted", heading: "Invitation accepted", body: `${actor} accepted your reservation invitation.` },
    reservation_invitation_declined: { subject: "Reservation invitation update", heading: "Invitation declined", body: `${actor} declined your reservation invitation.` },
    waitlist_joined: { subject: "Player joined the waitlist", heading: "Your court has a waitlist", body: `${actor} joined the waitlist for your open court.` },
    waitlist_added: { subject: "You joined the waitlist", heading: "You are on the waitlist", body: "You have been added to the reservation waitlist." },
    waitlist_promoted: { subject: "A court place opened", heading: "You can join the court", body: "A place is now available in the open court." },
    court_available: { subject: "Padel court available", heading: "A court is available", body: "A reservation slot you were waiting for is now available." },
  };
  return messages[key] || { subject: "Padel court update", heading: "There is an update", body: "There is a new update concerning your padel court account." };
}

function emailHtml(item: OutboxItem, timeZone: string) {
  const message = messageFor(item);
  const name = escapeHtml(item.recipient_name?.trim() || "Player");
  const schedule = reservationTime(item, timeZone);
  return {
    subject: message.subject,
    html: `<!doctype html><html><body style="margin:0;background:#F4F7FA;font-family:Arial,sans-serif;color:#26313B"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#1478B8;color:#F4F7FA;padding:18px 22px;border-radius:22px 22px 0 0;font-weight:700">Padel Court</div><div style="background:#F6F8FB;border:1px solid #C3C7CC;border-top:0;padding:28px 22px;border-radius:0 0 22px 22px"><p style="margin:0 0 14px">Hello ${name},</p><h1 style="font-size:24px;line-height:1.2;margin:0 0 12px">${escapeHtml(message.heading)}</h1><p style="font-size:16px;line-height:1.6;margin:0">${escapeHtml(message.body)}</p>${schedule ? `<div style="margin-top:20px;padding:14px;background:#D9E8F2;border-radius:16px;font-weight:700">${escapeHtml(schedule)}</div>` : ""}<p style="font-size:12px;color:#6E767E;margin:24px 0 0">This email was sent automatically from your padel court account.</p></div></div></body></html>`,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const dispatchSecret = Deno.env.get("EMAIL_DISPATCH_SECRET");
  if (!dispatchSecret || request.headers.get("x-dispatch-secret") !== dispatchSecret) {
    return json({ error: "Email dispatcher authentication failed." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom = Deno.env.get("EMAIL_FROM");
  const timeZone = Deno.env.get("FACILITY_TIMEZONE") || "Asia/Beirut";
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom) {
    return json({ error: "Email sender configuration is incomplete." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.rpc("claim_email_notification_outbox", { p_limit: 25 });
  if (error) return json({ error: "Email notifications could not be claimed." }, 500);

  const items = (data || []) as OutboxItem[];
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    const email = emailHtml(item, timeZone);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: emailFrom, to: [item.recipient_email], subject: email.subject, html: email.html }),
      });
      const payload = await response.json() as { id?: string; message?: string };
      if (!response.ok || !payload.id) throw new Error(payload.message || `Email provider returned ${response.status}.`);

      await admin.from("email_notification_outbox").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: payload.id, updated_at: new Date().toISOString() }).eq("id", item.id);
      if (item.notification_id) {
        await admin.from("notifications").update({ delivery_status: "sent", sent_at: new Date().toISOString(), external_message_id: payload.id, error_message: null, updated_at: new Date().toISOString() }).eq("id", item.notification_id);
      }
      sent += 1;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message.slice(0, 500) : "Email delivery failed.";
      const retryMinutes = Math.min(2 ** item.attempts, 60);
      await admin.from("email_notification_outbox").update({ status: "failed", error_message: errorMessage, available_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(), updated_at: new Date().toISOString() }).eq("id", item.id);
      if (item.notification_id) {
        await admin.from("notifications").update({ delivery_status: "failed", error_message: errorMessage, updated_at: new Date().toISOString() }).eq("id", item.notification_id);
      }
      failed += 1;
    }
  }

  return json({ claimed: items.length, sent, failed });
});
