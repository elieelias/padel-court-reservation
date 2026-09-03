import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

// Run the small TypeScript helpers with Node's built-in test runner. No browser,
// signed-in account, calendar event, or real booking is created by these tests.
function loadHelper(name) {
  const filename = path.join(testDirectory, "../src/features/booking/lib", name);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, URL, URLSearchParams,
    require(id) {
      assert.equal(id, "@/lib/config");
      return { facilityName: "Test Court, Beirut", siteUrl: "https://example.test", defaultSiteUrl: "https://padel-court-reservation-web.vercel.app" };
    },
  }, { filename });
  return exports;
}

const { shareReservationDetails } = loadHelper("reservation-sharing.ts");
const { googleCalendarUrl, appleCalendarFile } = loadHelper("calendar-links.ts");
const { reservationReceiptUrl } = loadHelper("receipt-link.ts");

test("receipt QR uses the configured hosted site without needing a browser", () => {
  assert.equal(reservationReceiptUrl("test-token"), "https://example.test/receipt/test-token");
  assert.equal(reservationReceiptUrl("test-token", "https://court.example.com/path/?query=1"), "https://court.example.com/receipt/test-token");
});

test("receipt QR falls back to Vercel for local, insecure, or invalid settings", () => {
  for (const origin of ["http://localhost:3000", "https://localhost:3000", "https://dev.localhost", "https://padel.local", "https://padel.internal", "https://192.168.0.128:3000", "https://127.0.0.1", "https://[::1]", "http://court.example.com", "", "not a URL", "https://user:secret@court.example.com"]) {
    assert.equal(reservationReceiptUrl("test-token", origin), "https://padel-court-reservation-web.vercel.app/receipt/test-token", origin);
  }
});

test("receipt QR keeps the pass UUID readable by the admin scanner", () => {
  const token = "00000000-0000-4000-8000-000000000001";
  const url = reservationReceiptUrl(token, "https://example.test/");
  assert.equal(new URL(url).pathname, `/receipt/${token}`);
  assert.equal(url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0], token);
});
const data = { title: "Test booking", text: "Court · 18:00–19:00", url: "https://example.test" };

test("opens native sharing with the provided match details", async () => {
  let received;
  assert.equal(await shareReservationDetails(data, { share: async (value) => { received = value; } }), "shared");
  assert.equal(received, data);
});

test("cancelling native sharing does not copy details", async () => {
  let copied = false;
  const result = await shareReservationDetails(data, {
    share: async () => { throw { name: "AbortError" }; },
    copy: async () => { copied = true; },
  });
  assert.equal(result, "cancelled");
  assert.equal(copied, false);
});

test("copies details when native sharing is unavailable", async () => {
  let copied;
  assert.equal(await shareReservationDetails(data, { copy: async (value) => { copied = value; } }), "copied");
  assert.equal(copied, `${data.text}\n${data.url}`);
});

test("a blocked native share falls back to the clipboard", async () => {
  assert.equal(await shareReservationDetails(data, {
    share: async () => { throw { name: "NotAllowedError" }; },
    copy: async () => {},
  }), "copied");
});

test("blocked clipboard access offers manual copying", async () => {
  assert.equal(await shareReservationDetails(data, {
    copy: async () => { throw new Error("permission denied"); },
  }), "manual");
});

test("a browser without either API offers manual copying", async () => {
  assert.equal(await shareReservationDetails(data, {}), "manual");
});

const reservation = { startAt: "2026-09-01T18:00:00+03:00", endAt: "2026-09-01T19:30:00+03:00" };

test("Google Calendar includes the exact UTC range and weekly count", () => {
  const url = new URL(googleCalendarUrl({ ...reservation, occurrenceCount: 3 }));
  assert.equal(url.origin, "https://calendar.google.com");
  assert.equal(url.searchParams.get("dates"), "20260901T150000Z/20260901T163000Z");
  assert.equal(url.searchParams.get("recur"), "RRULE:FREQ=WEEKLY;COUNT=3");
});

test("calendar exports use the current administrator-managed facility name", () => {
  const displayName = "Blue Court Club";
  const google = new URL(googleCalendarUrl(reservation, displayName));
  const apple = appleCalendarFile(reservation, displayName);
  assert.equal(google.searchParams.get("text"), `${displayName} reservation`);
  assert.equal(google.searchParams.get("location"), displayName);
  assert.ok(apple.includes(`SUMMARY:${displayName} reservation`));
  assert.ok(apple.includes(`LOCATION:${displayName}`));
});

test("Apple Calendar contains the reservation and escapes venue punctuation", () => {
  const file = appleCalendarFile(reservation);
  assert.ok(file.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(file.includes("DTSTART:20260901T150000Z\r\n"));
  assert.ok(file.includes("DTEND:20260901T163000Z\r\n"));
  assert.ok(file.includes("LOCATION:Test Court\\, Beirut"));
  assert.ok(!file.includes("RRULE:"));
});

test("Apple Calendar includes the requested recurring booking count", () => {
  assert.ok(appleCalendarFile({ ...reservation, occurrenceCount: 4 }).includes("RRULE:FREQ=WEEKLY;COUNT=4"));
});
