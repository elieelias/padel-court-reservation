import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";

function load(relativePath, require, env = {}) {
  const filename = fileURLToPath(new URL(relativePath, import.meta.url));
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require, process: { env } }, { filename });
  return exports;
}
const access = load("../src/lib/route-access.ts");
const token = "00000000-0000-4000-8000-000000000001";
const receiptPath = `/receipt/${token}`;

test("only single UUID receipt paths are public", () => {
  assert.equal(access.isPublicPath(receiptPath), true);
  assert.equal(access.isPublicPath(`${receiptPath}/`), true);
  for (const pathname of ["/receipt", "/receipt/invalid", `${receiptPath}/edit`, "/receipts", "/book", "/profile", "/profile/friends", "/open-courts", "/events", "/players/player", "/reservations"]) {
    assert.equal(access.isPublicPath(pathname), false, pathname);
  }
  assert.equal(access.isPublicPath("/"), true);
  assert.equal(access.isPublicPath("/auth/sign-in"), true);
  assert.equal(access.isPublicPath("/auth/hooks/before-user-created"), true);
});

function proxy({ signedIn = false, configured = true, refreshCookie = false } = {}) {
  let calls = 0;
  const { updateSession } = load("../src/lib/supabase/proxy.ts", (id) => {
    if (id === "@/lib/route-access") return access;
    if (id === "next/server") return { NextResponse };
    if (id === "@supabase/ssr") return { createServerClient: (_url, _key, config) => {
      calls++;
      return { auth: { getClaims: async () => {
        if (refreshCookie) config.cookies.setAll([{ name: "session-test", value: "fresh", options: { httpOnly: true, path: "/", sameSite: "lax" } }]);
        return { data: signedIn ? { claims: { sub: "test-player" } } : null };
      } } };
    } };
    throw new Error(`Unexpected import: ${id}`);
  }, configured ? { NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key" } : {});
  return { updateSession, calls: () => calls };
}

test("a camera receipt request never requires login or a session refresh", async () => {
  const instance = proxy();
  const response = await instance.updateSession(new NextRequest(`https://app.test${receiptPath}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(instance.calls(), 0);
});

test("signed-out player pages still redirect to the landing page", async () => {
  for (const path of ["/book", "/profile", "/profile/friends", "/open-courts", "/events", `${receiptPath}/edit`]) {
    const response = await proxy().updateSession(new NextRequest(`https://app.test${path}?private=test`));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://app.test/");
  }
});

test("signed-in players still reach protected pages", async () => {
  const response = await proxy({ signedIn: true }).updateSession(new NextRequest("https://app.test/book"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
});

test("signed-in players cannot reopen the landing page", async () => {
  const response = await proxy({ signedIn: true, refreshCookie: true }).updateSession(new NextRequest("https://app.test/?from=old-link"));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://app.test/book");
  assert.equal(response.cookies.get("session-test")?.value, "fresh");
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
});

test("signed-out visitors can still reach the landing page", async () => {
  const response = await proxy().updateSession(new NextRequest("https://app.test/"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
});

test("the app logo and 404 action point directly to Book", () => {
  const shell = readFileSync(new URL("../src/shared/layout/app-shell.tsx", import.meta.url), "utf8");
  const notFound = readFileSync(new URL("../src/app/not-found.tsx", import.meta.url), "utf8");
  assert.equal((shell.match(/className="brand" href="\/book"/g) ?? []).length, 2);
  assert.match(notFound, /href="\/book"/);
});

test("missing app configuration does not open protected routes", async () => {
  assert.equal((await proxy({ configured: false }).updateSession(new NextRequest("https://app.test/profile"))).status, 307);
});
