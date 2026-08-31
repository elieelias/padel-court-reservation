import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

// Exercise the component's actual click handlers without an account or live deletion.
const source = ts.transpileModule(readFileSync(new URL("../src/features/profile/components/friend-manager.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const friend = { friendship_id: "friendship-1", player_id: "player-2", username: "testfriend", status: "accepted", direction: "friends" };

function harness(respond = async () => ({ error: null })) {
  // Initial friendship fetch has completed; the remaining state uses component defaults.
  const state = [[friend], [], "", false];
  let cursor = 0;
  let refreshes = 0;
  const calls = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
    useEffect() {},
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
  };
  const exports = {};
  vm.runInNewContext(source, { exports, require(id) {
    if (id === "react") return react;
    if (id === "react/jsx-runtime") return jsx;
    if (id === "lucide-react") return new Proxy({}, { get: (_, key) => key });
    if (id === "next/link") return { default: "a" };
    if (id === "next/navigation") return { useRouter: () => ({ refresh: () => refreshes++ }) };
    if (id === "@/shared/preferences/language-provider") return { useLanguage: () => ({ locale: "en", t: (key) => key }) };
    if (id === "@/lib/supabase/client") return { createClient: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return respond(); } }) };
    throw new Error(`Unexpected import ${id}`);
  } }); // No window.confirm: browser dialogs must not be needed.
  function render() {
    cursor = 0;
    const elements = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      elements.push(node);
      visit(node.props?.children);
    }
    visit(exports.FriendManager());
    return elements;
  }
  function button(className) {
    return render().find((node) => node.type === "button" && node.props.className === className);
  }
  return {
    calls, render, refreshes: () => refreshes,
    open: () => button("friend-unfriend-button").props.onClick(),
    confirm: () => button("friend-unfriend-button friend-unfriend-button--confirm"),
    cancel: () => render().find((node) => node.type === "button" && node.props.children === "common.cancel").props.onClick(),
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("Unfriend opens an inline confirmation without making a request; Cancel keeps the friend", () => {
  const app = harness();
  app.open();
  assert.ok(app.confirm());
  assert.equal(app.calls.length, 0);
  app.cancel();
  assert.equal(app.confirm(), undefined);
  assert.equal(app.calls.length, 0);
  assert.ok(app.render().some((node) => node.props?.href === "/players/testfriend"));
});

test("confirming removes the friend and refreshes the profile", async () => {
  const app = harness();
  app.open();
  app.confirm().props.onClick();
  await flush();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].name, "remove_friend");
  assert.equal(app.calls[0].args.p_friendship_id, friend.friendship_id);
  assert.equal(app.confirm(), undefined);
  assert.equal(app.refreshes(), 1);
  assert.equal(app.render().some((node) => node.props?.href === "/players/testfriend"), false);
});

test("duplicate taps cannot send duplicate removals", async () => {
  let finish;
  const app = harness(() => new Promise((resolve) => { finish = resolve; }));
  app.open();
  const click = app.confirm().props.onClick;
  click();
  click();
  assert.equal(app.calls.length, 1);
  assert.equal(app.confirm().props.disabled, true);
  finish({ error: null });
  await flush();
});

for (const kind of ["database error", "network failure"]) {
  test(`${kind} keeps the friend, shows an inline error and allows retry`, async () => {
    let fail = true;
    const app = harness(async () => {
      if (!fail) return { error: null };
      if (kind === "network failure") throw new Error("offline");
      return { error: { code: "P0002" } };
    });
    app.open();
    app.confirm().props.onClick();
    await flush();
    assert.ok(app.render().some((node) => node.props?.role === "alert"));
    assert.ok(app.render().some((node) => node.props?.href === "/players/testfriend"));
    assert.equal(app.confirm().props.disabled, false);
    assert.equal(app.refreshes(), 0);
    fail = false;
    app.confirm().props.onClick();
    await flush();
    assert.equal(app.calls.length, 2);
    assert.equal(app.refreshes(), 1);
  });
}
