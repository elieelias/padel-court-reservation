import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
const source = readFileSync(new URL("../src/features/profile/lib/reservation-history.ts", import.meta.url), "utf8");
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { isReservationHistoryEntry } = exports;
const now = new Date("2026-09-03T12:00:00Z");
const reservation = (status, end_at) => ({ status, end_at });

test("ended confirmed and pending matches appear in reservation history", () => {
  assert.equal(isReservationHistoryEntry(reservation("confirmed", "2026-09-03T11:59:59Z"), now), true);
  assert.equal(isReservationHistoryEntry(reservation("pending", "2026-09-02T10:00:00Z"), now), true);
});

test("upcoming and cancelled reservations do not appear in history", () => {
  assert.equal(isReservationHistoryEntry(reservation("confirmed", "2026-09-03T12:00:01Z"), now), false);
  assert.equal(isReservationHistoryEntry(reservation("cancelled", "2026-09-02T10:00:00Z"), now), false);
});

test("completed and expired matches appear only after their end time", () => {
  assert.equal(isReservationHistoryEntry(reservation("completed", "2026-09-03T12:00:00Z"), now), true);
  assert.equal(isReservationHistoryEntry(reservation("expired", "2026-09-04T12:00:00Z"), now), false);
});
