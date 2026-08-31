import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const effects = [];
const refs = [];
function load(file, extra = "") {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText + extra, {
    exports,
    document: { body: { style: { overflow: "auto" } } },
    require(id) {
      if (id === "react") return {
        useEffect: (fn) => effects.push(fn), useRef: (value) => { const ref = { current: value }; refs.push(ref); return ref; },
        useMemo: (fn) => fn(), useState: (value) => [value, () => {}],
      };
      if (id === "@/shared/preferences/language-provider") return { useLanguage: () => ({ locale: "en", t: (key) => key }) };
      if (id === "@/lib/i18n") return { intlLocale: () => "en-US" };
      if (id.endsWith("/receipt-link")) return { reservationReceiptUrl: () => "https://example.test/receipt/test" };
      if (id.endsWith("/calendar-links")) return { googleCalendarUrl: () => "https://calendar.google.com", appleCalendarFile: () => "" };
      if (id.startsWith("@/")) return {};
      return require(id);
    },
  });
  return exports;
}
const { TestPass } = load("../src/features/booking/components/player-reservations.tsx", "\nexports.TestPass = ReservationPass;");
const { PostBookingActions } = load("../src/features/booking/components/post-booking-actions.tsx");
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
const reservation = { id: "test", pass_token: "test", pass_code: "TEST123", start_at: "2026-09-10T15:00:00Z", end_at: "2026-09-10T16:00:00Z", status: "confirmed", type: "private", payment_status: "paid", price: 20 };

test("receipt provides Done and close buttons and opts out of sharing", () => {
  let closed = 0;
  const tree = TestPass({ playerName: "Test player", reservation, onClose: () => closed++ });
  assert.equal(tree.type, "dialog");
  const elements = nodes(tree);
  const done = elements.find((node) => node.type === "button" && node.props.children === "booking.done");
  done.props.onClick();
  elements.find((node) => node.props?.["aria-label"] === "common.close").props.onClick();
  let prevented = false;
  tree.props.onCancel({ preventDefault: () => { prevented = true; } });
  assert.equal(closed, 3);
  assert.equal(prevented, true);
  assert.ok(elements.some((node) => node.props?.showShare === false));
  assert.ok(elements.some((node) => node.props?.className === "reservation-pass__body"));
  assert.ok(elements.some((node) => node.props?.className === "reservation-pass__footer"));
});

test("receipt modal uses showModal and releases it on unmount", () => {
  effects.length = 0;
  refs.length = 0;
  TestPass({ playerName: "Test player", reservation, onClose() {} });
  let opened = 0;
  let closed = 0;
  refs[0].current = { showModal: () => opened++, close: () => closed++ };
  const cleanup = effects[0]();
  assert.equal(opened, 1);
  cleanup();
  assert.equal(closed, 1);
});

test("receipt hides Share without removing calendar actions or sharing elsewhere", () => {
  const props = { startAt: reservation.start_at, endAt: reservation.end_at };
  const receipt = nodes(PostBookingActions({ ...props, showShare: false }));
  assert.equal(receipt.some((node) => node.props?.className?.includes("--share")), false);
  assert.equal(receipt.filter((node) => node.props?.className === "post-booking-action").length, 2);
  assert.ok(nodes(PostBookingActions(props)).some((node) => node.props?.className?.includes("--share")));
});

test("pass dimensions are viewport-bounded and only the body scrolls", () => {
  const css = readFileSync(new URL("../src/stylesheets/app.css", import.meta.url), "utf8");
  assert.match(css, /\.reservation-pass \{[^}]*max-height: calc\(100dvh/);
  assert.match(css, /\.reservation-pass__body \{[^}]*overflow-y: auto/);
  assert.match(css, /\.reservation-pass__footer \{[^}]*flex-shrink: 0/);
});
