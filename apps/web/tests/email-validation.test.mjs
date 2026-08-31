import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { Webhook } from "standardwebhooks";

const require = createRequire(import.meta.url);
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/features/auth/lib");
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const filename = path.join(directory, name);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, URL, Buffer, Response, setTimeout, clearTimeout,
    require(id) { return id.startsWith("./") ? load(`${id.slice(2)}.ts`) : require(id); },
  }, { filename });
  modules.set(name, exports);
  return exports;
}
const { checkEmailSyntax, emailDomain } = load("email-policy.ts");
const { checkMailRouting } = load("email-domain.server.ts");
const { handleEmailCheck, handleBeforeUserCreated } = load("email-check-handlers.server.ts");
const dnsError = (code) => Object.assign(new Error(code), { code });
const noData = async () => { throw dnsError("ENODATA"); };
const dns = (overrides = {}) => ({ resolveMx: noData, resolve4: noData, resolve6: noData, ...overrides });

test("valid personal, plus-addressed and custom-domain email formats remain allowed", () => {
  for (const email of ["player@gmail.com", "player+padel@outlook.com", "first.last@club.com.lb", "o'neil@university.edu", " PLAYER@GMAIL.COM ", "player@bücher.de"]) {
    assert.equal(checkEmailSyntax(email).ok, true, email);
  }
  assert.equal(emailDomain("player@bücher.de"), "xn--bcher-kva.de");
});

test("malformed addresses are rejected", () => {
  for (const email of ["plain", "@gmail.com", "a@@gmail.com", "a b@gmail.com", "a..b@gmail.com", ".a@gmail.com", "a.@gmail.com", "a@bad_domain.com", "a@-bad.com", "a@bad-.com", "a@127.0.0.1", "a@localhost", "a@gmail.com/evil", "a@gmail.com#evil", "a@gmail.com.", `${"a".repeat(65)}@gmail.com`]) {
    assert.equal(checkEmailSyntax(email).ok, false, email);
  }
});

test("reserved example and local domains are rejected, including subdomains", () => {
  for (const domain of ["example.com", "example.org", "example.net", "sub.example.com", "club.test", "club.invalid", "club.example", "club.localhost", "club.local", "club.internal", "club.home.arpa"]) {
    assert.equal(checkEmailSyntax(`player@${domain}`).reason, "reserved", domain);
  }
});

test("reserved domains are rejected without performing DNS queries", async () => {
  let queried = false;
  const result = await checkMailRouting("player@example.com", dns({ resolveMx: async () => { queried = true; return []; } }));
  assert.equal(result.reason, "reserved");
  assert.equal(queried, false);
});

test("a mail exchange allows a domain but does not prove mailbox existence", async () => {
  const result = await checkMailRouting("possibly-nonexistent@gmail.com", dns({ resolveMx: async () => [{ exchange: "mail.gmail.com", priority: 10 }] }));
  assert.equal(result.ok, true);
});

test("null MX explicitly prevents delivery, even with address records", async () => {
  for (const exchange of [".", ""]) {
    const result = await checkMailRouting("player@club.com", dns({ resolveMx: async () => [{ exchange, priority: 0 }], resolve4: async () => ["203.0.113.1"] }));
    assert.equal(result.reason, "no_mail");
  }
});

test("nonexistent domains are rejected without trying address fallback", async () => {
  let fallback = false;
  const result = await checkMailRouting("player@does-not-exist.com", dns({
    resolveMx: async () => { throw dnsError("ENOTFOUND"); },
    resolve4: async () => { fallback = true; return ["203.0.113.1"]; },
  }));
  assert.equal(result.reason, "no_mail");
  assert.equal(fallback, false);
});

test("SMTP A and AAAA fallback is supported when there is no MX", async () => {
  assert.equal((await checkMailRouting("player@club.com", dns({ resolve4: async () => ["203.0.113.1"] }))).ok, true);
  assert.equal((await checkMailRouting("player@club.com", dns({ resolveMx: async () => [], resolve6: async () => ["2001:db8::1"] }))).ok, true);
  assert.equal((await checkMailRouting("player@club.com", dns())).reason, "no_mail");
});

test("DNS outages fail closed with a retryable result, not a fake-address label", async () => {
  for (const code of ["ETIMEOUT", "ESERVFAIL", "EREFUSED"]) {
    assert.equal((await checkMailRouting("player@club.com", dns({ resolveMx: async () => { throw dnsError(code); } }))).reason, "unavailable");
  }
  assert.equal((await checkMailRouting("player@club.com", dns({ resolve4: async () => { throw dnsError("ETIMEOUT"); } }))).reason, "unavailable");
});

const jsonRequest = (body) => new Request("https://app.test/auth/email-check", { method: "POST", body: JSON.stringify(body) });
test("preflight returns no-store success or a clear rejection", async () => {
  const allowed = await handleEmailCheck(jsonRequest({ email: "player@gmail.com" }), async () => ({ ok: true }));
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("cache-control"), "no-store");
  const blocked = await handleEmailCheck(jsonRequest({ email: "player@example.com" }), async () => ({ ok: false, reason: "reserved" }));
  assert.equal(blocked.status, 400);
  assert.equal((await blocked.json()).reason, "reserved");
  const temporary = await handleEmailCheck(jsonRequest({ email: "player@gmail.com" }), async () => ({ ok: false, reason: "unavailable" }));
  assert.equal(temporary.status, 503);
});

test("malformed and oversized preflight bodies never reach validation", async () => {
  let calls = 0;
  for (const body of [null, {}, { email: 42 }, { email: "a".repeat(3000) }]) {
    assert.equal((await handleEmailCheck(jsonRequest(body), async () => { calls++; return { ok: true }; })).status, 400);
  }
  assert.equal(calls, 0);
});

// A synthetic signing key used only by this test; not an application credential.
const secret = Buffer.from("only-a-local-unit-test-signing-key").toString("base64");
function signedRequest(event, date = new Date(), signingSecret = secret) {
  const payload = JSON.stringify(event);
  const id = "test-hook-message";
  return new Request("https://app.test/auth/hooks/before-user-created", {
    method: "POST", body: payload,
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(date.getTime() / 1000)),
      "webhook-signature": new Webhook(signingSecret).sign(id, date, payload),
    },
  });
}
test("hook rejects missing configuration and unsigned requests before validation", async () => {
  let calls = 0;
  const validator = async () => { calls++; return { ok: true }; };
  assert.equal((await handleBeforeUserCreated(jsonRequest({}), undefined, validator)).status, 503);
  assert.equal((await handleBeforeUserCreated(jsonRequest({ user: { email: "a@gmail.com" } }), secret, validator)).status, 401);
  assert.equal(calls, 0);
});

test("hook verifies signatures and permits an acceptable email", async () => {
  let received;
  const response = await handleBeforeUserCreated(signedRequest({ user: { email: "a@gmail.com" } }), `v1,whsec_${secret}`, async (email) => { received = email; return { ok: true }; });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {});
  assert.equal(received, "a@gmail.com");
});

test("expired or incorrect signatures cannot invoke DNS validation", async () => {
  let calls = 0;
  const validator = async () => { calls++; return { ok: true }; };
  const event = { user: { email: "a@gmail.com" } };
  assert.equal((await handleBeforeUserCreated(signedRequest(event, new Date(Date.now() - 600_000)), secret, validator)).status, 401);
  assert.equal((await handleBeforeUserCreated(signedRequest(event), Buffer.from("different-test-key").toString("base64"), validator)).status, 401);
  assert.equal(calls, 0);
});

test("signed invalid emails and DNS outages block account creation", async () => {
  for (const reason of ["invalid", "reserved", "no_mail", "unavailable"]) {
    const response = await handleBeforeUserCreated(signedRequest({ user: { email: "a@club.com" } }), secret, async () => ({ ok: false, reason }));
    assert.equal(response.status, reason === "unavailable" ? 503 : 400);
    assert.equal((await response.json()).error.message, `signup_email_${reason}`);
  }
  assert.equal((await handleBeforeUserCreated(signedRequest({ user: {} }), secret, async () => ({ ok: true }))).status, 400);
});
