import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/features/booking/lib/pending-invitations.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { loadPendingInvitations } = exports;
const row = (id, status, is_host = true) => ({ reservation_id: id, status, is_host });
function client(rows, reservations, error = null) {
  return {
    rpc: async () => ({ data: rows, error: null }),
    from(table) {
      assert.equal(table, "reservations");
      return { select(columns) {
        assert.equal(columns, "id,status");
        return { in: async () => ({ data: reservations, error }) };
      } };
    },
  };
}

test("a private lineup disappears when the final acceptance confirms the reservation", async () => {
  const rows = [row("private", "accepted"), row("private", "pending")];
  assert.equal((await loadPendingInvitations(client(rows, [{ id: "private", status: "pending" }]))).length, 2);
  rows[1].status = "accepted";
  assert.equal((await loadPendingInvitations(client(rows, [{ id: "private", status: "confirmed" }]))).length, 0);
});
test("pending open courts remain even if every invitation is accepted", async () => {
  assert.equal((await loadPendingInvitations(client([row("open", "accepted")], [{ id: "open", status: "pending" }]))).length, 1);
});
test("a declined invitation remains visible while a pending host lineup needs attention", async () => {
  assert.equal((await loadPendingInvitations(client([row("private", "declined")], [{ id: "private", status: "pending" }]))).length, 1);
});
test("guests only see unanswered invitations; cancelled invitations are hidden", async () => {
  const rows = [row("a", "pending", false), row("b", "accepted", false), row("c", "declined", false), row("d", "cancelled")];
  const result = await loadPendingInvitations(client(rows, [{ id: "d", status: "pending" }]));
  assert.equal(result.length, 1);
  assert.equal(result[0].reservation_id, "a");
});
test("completed, cancelled and expired bookings are excluded", async () => {
  for (const status of ["completed", "cancelled", "expired"]) {
    assert.equal((await loadPendingInvitations(client([row("a", "accepted")], [{ id: "a", status }]))).length, 0);
  }
});
test("query failures are reported instead of being mistaken for an empty list", async () => {
  await assert.rejects(loadPendingInvitations(client([row("a", "pending")], null, new Error("offline"))), /offline/);
  await assert.rejects(loadPendingInvitations({ rpc: async () => ({ error: new Error("session expired") }) }), /session expired/);
});
test("empty lists do not issue an empty reservation query", async () => {
  const result = await loadPendingInvitations({ rpc: async () => ({ data: [], error: null }) });
  assert.equal(result.length, 0);
});
