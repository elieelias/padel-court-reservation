import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../../supabase/migrations/20260903102321_cancel_reservations_overlapping_blocked_time.sql", import.meta.url), "utf8");
const eventKeyMigration = readFileSync(new URL("../../../supabase/migrations/20260903102632_add_blocked_time_notification_key.sql", import.meta.url), "utf8");
const emailSender = readFileSync(new URL("../../../supabase/functions/send-notification-emails/index.ts", import.meta.url), "utf8");
const bookingExperience = readFileSync(new URL("../src/features/booking/components/booking-experience.tsx", import.meta.url), "utf8");

test("a facility block cancels only overlapping future active reservations", () => {
  assert.match(migration, /status in \('pending', 'confirmed'\)/);
  assert.match(migration, /reservation\.start_at < new\.end_at/);
  assert.match(migration, /reservation\.end_at > new\.start_at/);
  assert.match(migration, /status = 'cancelled'/);
});

test("affected players receive a dedicated cancellation notification and email", () => {
  assert.match(migration, /'blocked_time_cancellation'/);
  assert.match(migration, /insert into public\.notifications/);
  assert.match(eventKeyMigration, /'blocked_time_cancellation'/);
  assert.match(emailSender, /blocked_time_cancellation: \{ subject: "Reservation cancelled by the facility"/);
});

test("an open booking calendar refreshes after administrator changes", () => {
  assert.match(bookingExperience, /setInterval\(refreshAvailability, 15_000\)/);
  assert.match(bookingExperience, /addEventListener\("focus", refreshAvailability\)/);
});
