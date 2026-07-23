import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The running-dog navigation overlay must NOT cover the dashboard on section
// switches — the sitter (/host) and owner (/account) shells keep a persistent
// sidebar, and each section's loading.tsx renders an in-flow skeleton instead.
// Mirror the predicate inline + assert the wiring (same style as
// navOverlayAdminSkip.test.ts, since the component imports via "@/").

function isDashboardRoute(pathOnly: string): boolean {
  return (
    pathOnly === "/host" ||
    pathOnly.startsWith("/host/") ||
    pathOnly === "/account" ||
    pathOnly.startsWith("/account/")
  );
}

test("dashboard routes are skip (no full-screen overlay)", () => {
  assert.equal(isDashboardRoute("/host"), true);
  assert.equal(isDashboardRoute("/host/availability"), true);
  assert.equal(isDashboardRoute("/host/messages"), true);
  assert.equal(isDashboardRoute("/account"), true);
  assert.equal(isDashboardRoute("/account/bookings"), true);
});

test("non-dashboard routes still get the overlay", () => {
  assert.equal(isDashboardRoute("/"), false);
  assert.equal(isDashboardRoute("/sitter/s-123"), false);
  assert.equal(isDashboardRoute("/administration"), false, "must not prefix-match /administration");
  assert.equal(isDashboardRoute("/accounts"), false, "must not prefix-match /accounts");
});

test("NavigationOverlayController wires isDashboardRoute into both trigger paths", () => {
  const src = readFileSync(
    new URL("../../components/NavigationOverlayController.tsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /export function isDashboardRoute/, "isDashboardRoute must be the single source of the rule.");
  assert.match(src, /function isSkippedHref[\s\S]*?isDashboardRoute\(/, "click-capture path must skip dashboard routes.");
  assert.match(src, /shouldShowOverlayFor[\s\S]*?isDashboardRoute\(pathOnly\)/, "programmatic path must skip dashboard routes.");
});

test("web dashboard section loaders render an in-flow skeleton, not the running dog", () => {
  const fallback = readFileSync(
    new URL("../../components/native/NativeRouteFallback.tsx", import.meta.url),
    "utf8",
  );
  assert.match(fallback, /web === "loader"\)\s*return <WebSectionSkeleton/, "web loader branch must use the in-flow WebSectionSkeleton.");
  assert.doesNotMatch(fallback, /web === "loader"\)\s*return <PageLoader/, "web loader branch must no longer render the full-screen PageLoader.");
});
