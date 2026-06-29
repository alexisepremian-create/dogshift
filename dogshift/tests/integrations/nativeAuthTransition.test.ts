/**
 * Regression test for docs/bugs/native-logout-login-branded-transition.md.
 *
 * Two native-app bugs are locked in here:
 *   1. Logout must clear the native Google/Apple session so the next sign-in
 *      shows the account chooser (it used to silently re-use the same account).
 *   2. Logout AND login must show ONE branded purple+paw cover instead of the
 *      skeleton → cold-splash → skeleton cascade. The cover is driven by a
 *      sessionStorage flag (begin/end) that survives the hard navigations.
 *
 * String-level assertions (no DOM/WKWebView in the node test runner) — they
 * guard that the wiring isn't silently removed in a refactor.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

test("sign-out clears the native social session (account chooser on next login)", () => {
  const src = read("app/sign-out/page.tsx");
  assert.match(
    src,
    /@capgo\/capacitor-social-login/,
    "Expected /sign-out to import @capgo/capacitor-social-login to clear the native session.",
  );
  assert.match(
    src,
    /SocialLogin\.logout/,
    "Expected /sign-out to call SocialLogin.logout — without it the native Google/Apple session survives logout and the next sign-in silently reuses the same account.",
  );
  assert.match(
    src,
    /isNativePlatform/,
    "Native session clearing must be gated on Capacitor.isNativePlatform so web is unaffected.",
  );
});

test("authTransition helpers expose begin/active/end + a single sessionStorage key", () => {
  const src = read("lib/native/authTransition.ts");
  for (const fn of ["beginAuthTransition", "authTransitionActive", "endAuthTransition"]) {
    assert.match(src, new RegExp(`export function ${fn}`), `Expected ${fn} to be exported.`);
  }
  assert.match(src, /sessionStorage/, "The flag must live in sessionStorage so it survives the hard navigations.");
});

test("the branded cover is mounted globally and renders NativeBrandedLoader", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /AuthTransitionCover/, "Expected <AuthTransitionCover/> to be mounted in the root layout.");
  const cover = read("components/native/AuthTransitionCover.tsx");
  assert.match(cover, /NativeBrandedLoader/, "The cover must render the purple+paw NativeBrandedLoader.");
  assert.match(cover, /authTransitionActive/, "The cover must read the flag on mount (covers hard-nav reloads).");
  assert.match(cover, /AUTH_TRANSITION_BEGIN_EVENT/, "The cover must react to the begin event (client-nav case).");
});

test("the transition is BEGUN on logout and on every sign-in success", () => {
  assert.match(read("app/sign-out/page.tsx"), /beginAuthTransition\(\)/, "logout must begin the transition.");
  const flow = read("components/auth/AuthFlow.tsx");
  // Every post-auth redirect (google-native, apple-native, credentials) must begin first.
  const begins = (flow.match(/if \(isNative\) beginAuthTransition\(\);\s*\n\s*router\.replace\(callbackUrl\);/g) ?? []).length;
  assert.ok(
    begins >= 3,
    `Expected beginAuthTransition() before each router.replace(callbackUrl) success path (>=3), found ${begins}.`,
  );
});

test("the transition is ENDED at every destination (login screen + dashboards)", () => {
  assert.match(read("app/login/page.tsx"), /endAuthTransition\(\)/, "login screen must end the cover so the user can choose an account.");
  assert.match(read("components/HostDataGate.tsx"), /endAuthTransition\(\)/, "sitter dashboard must end the cover when ready.");
  assert.match(read("components/OwnerDashboardShell.tsx"), /endAuthTransition\(\)/, "owner dashboard must end the cover when ready.");
});

test("CSS hides the bottom nav + nav overlay while the cover is up", () => {
  const css = read("app/globals.css");
  assert.match(
    css,
    /html\[data-auth-transition="true"\][^{]*nav\[aria-label="Navigation principale"\]/,
    "Expected a data-auth-transition rule hiding the bottom nav so the navbar never flashes mid-transition.",
  );
});
