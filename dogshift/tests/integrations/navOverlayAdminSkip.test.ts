import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The running-dog navigation overlay must NOT flash on every click inside the
// admin panel — each admin section switch should feel instant (the panel ships
// its own sidebar-preserving skeleton). Reported 2026-07-21.
//
// We mirror the predicate inline (like sitterTermsModalGate.test.ts) so a
// refactor of NavigationOverlayController is caught here, plus a file-level
// assert that the predicate is actually wired into BOTH trigger paths.

function isAdminRoute(pathOnly: string): boolean {
  return pathOnly === "/admin" || pathOnly.startsWith("/admin/");
}

test("admin routes are treated as skip (instant) routes", () => {
  assert.equal(isAdminRoute("/admin"), true);
  assert.equal(isAdminRoute("/admin/users"), true);
  assert.equal(isAdminRoute("/admin/impersonate"), true);
});

test("non-admin routes still get the overlay", () => {
  assert.equal(isAdminRoute("/"), false);
  assert.equal(isAdminRoute("/account"), false);
  assert.equal(isAdminRoute("/host"), false);
  assert.equal(isAdminRoute("/administration"), false, "must not prefix-match /administration");
  assert.equal(isAdminRoute("/sitter/s-123"), false);
});

test("NavigationOverlayController wires isAdminRoute into both trigger paths", () => {
  const src = readFileSync(
    new URL("../../components/NavigationOverlayController.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    src,
    /export function isAdminRoute/,
    "isAdminRoute must exist as the single source of the admin-skip rule.",
  );
  // Link-click path (isSkippedHref) must consult it…
  assert.match(
    src,
    /function isSkippedHref[\s\S]*?isAdminRoute\(/,
    "the click-capture path (isSkippedHref) must skip admin routes.",
  );
  // …and the programmatic router.push/replace path (shouldShowOverlayFor) too.
  assert.match(
    src,
    /shouldShowOverlayFor[\s\S]*?isAdminRoute\(pathOnly\)/,
    "the programmatic-navigation path must also skip admin routes.",
  );
});
