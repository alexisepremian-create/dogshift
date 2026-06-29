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

test("the splash + failsafe controller are mounted globally", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /id="ds-auth-splash"/, "Expected the server-rendered #ds-auth-splash in the root layout.");
  assert.match(layout, /AuthTransitionCover/, "Expected <AuthTransitionCover/> (failsafe) mounted in the root layout.");
  const cover = read("components/native/AuthTransitionCover.tsx");
  assert.match(cover, /endAuthTransition/, "The failsafe controller must force-end a stuck transition.");
  assert.match(cover, /AUTH_TRANSITION_BEGIN_EVENT/, "It must (re)arm on the begin event (client-nav case).");
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

test("boot script stamps data-auth-transition from the surviving sessionStorage flag", () => {
  const layout = read("app/layout.tsx");
  assert.match(
    layout,
    /sessionStorage\.getItem\('ds_auth_transition'\)[\s\S]*?setAttribute\('data-auth-transition'/,
    "The synchronous boot script must read ds_auth_transition and set data-auth-transition on <html> so the cold splash can be frozen before first paint on a hard-nav reload.",
  );
});

test("auth transition uses an instant inline-SVG splash (no PNG decode gap)", () => {
  const css = read("app/globals.css");
  const layout = read("app/layout.tsx");
  assert.match(layout, /id="ds-auth-splash"[\s\S]*?BrandedSplashLogo/,
    "The layout must server-render #ds-auth-splash with BrandedSplashLogo (paints instantly, no purple-without-logo gap on reload).");
  const logo = read("components/native/BrandedSplashLogo.tsx");
  assert.match(logo, /ds-splash-paw/, "BrandedSplashLogo must render the real brand paw (.ds-splash-paw).");
  assert.doesNotMatch(logo, /<img|native-splash\.png/, "The component must not fetch an image (the paw is a base64 data-URI in the cached CSS).");
  // The paw must be the real asset inlined as base64 (instant, no fetch/2732² decode).
  assert.match(css, /\.ds-splash-paw\s*\{[\s\S]*?url\("data:image\/png;base64,/,
    ".ds-splash-paw must use a base64 data-URI so the brand paw paints with the cached CSS (no plain-purple gap).");
  assert.match(css, /html\[data-native="true"\]\[data-auth-transition="true"\]::before,\s*\n?\s*html\[data-native="true"\]\[data-auth-transition="true"\]::after\s*\{[^}]*display:\s*none/,
    "During an auth transition the PNG cold splash must be suppressed so only the instant splash shows.");
  assert.match(css, /\[data-auth-transition="true"\]\s+#ds-auth-splash\s*\{[^}]*display:\s*flex/,
    "#ds-auth-splash must be shown while data-auth-transition is set.");
});

test("login only ends the cover when ARRIVING from sign-out (not during a fresh login)", () => {
  const src = read("app/login/page.tsx");
  assert.match(
    src,
    /justSignedOutRef\.current\s*!==\s*true\)\s*return;\s*\n\s*endAuthTransition\(\)/,
    "The /login endAuthTransition must be gated on justSignedOutRef, else it wipes the cover mid-login and the login page flashes back.",
  );
});

test("CSS hides the bottom nav + nav overlay while the cover is up", () => {
  const css = read("app/globals.css");
  assert.match(
    css,
    /html\[data-auth-transition="true"\][^{]*nav\[aria-label="Navigation principale"\]/,
    "Expected a data-auth-transition rule hiding the bottom nav so the navbar never flashes mid-transition.",
  );
});
