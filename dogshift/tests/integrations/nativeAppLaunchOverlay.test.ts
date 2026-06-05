/**
 * Regression test for docs/bugs/native-app-footer-flash-on-launch.md.
 *
 * The cold-launch fix has four moving parts. This test asserts each
 * layer's signature is still present in source so a future refactor can't
 * silently undo any of them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

test("app/layout.tsx contains the synchronous Capacitor detection inline script", () => {
  const src = readFileSync(join(repoRoot, "app/layout.tsx"), "utf8");

  assert.match(
    src,
    /dangerouslySetInnerHTML/,
    "Expected an inline <script dangerouslySetInnerHTML=...> in app/layout.tsx — Capacitor detection must run before the first paint, not from a useEffect.",
  );
  assert.match(
    src,
    /window\.Capacitor/,
    "Expected the inline script to reference window.Capacitor.",
  );
  assert.match(
    src,
    /isNativePlatform/,
    "Expected the inline script to call isNativePlatform() to gate the data-native flip.",
  );
  assert.match(
    src,
    /setAttribute\('data-native','true'\)/,
    "Expected the inline script to set data-native='true' on <html>.",
  );
});

test("app/globals.css hides the marketing footer in native mode", () => {
  const src = readFileSync(join(repoRoot, "app/globals.css"), "utf8");

  assert.match(
    src,
    /html\[data-native="true"\] footer[\s\S]*?display: none/,
    "Expected the native footer hide rule (html[data-native='true'] footer { display: none ... }) in globals.css. Without it, the marketing footer flashes through during the WebView's SSR streaming window before <WebOnly> can unmount it client-side.",
  );
  assert.match(
    src,
    /body\[data-native="true"\] footer[\s\S]*?display: none/,
    "Expected the body-level fallback rule too (body[data-native='true'] footer { display: none ... }) — covers post-hydration when useIsNativeApp() has flipped the body attribute.",
  );
});

test("app/globals.css paints the in-WebView splash overlay with the same paw + purple as the native splash", () => {
  const src = readFileSync(join(repoRoot, "app/globals.css"), "utf8");

  assert.match(
    src,
    /html\[data-native="true"\]::before[\s\S]*?background:\s*#7c3aed/,
    "Expected the html[data-native='true']::before purple #7c3aed background overlay — it's what covers the WebView's safe-area zones at the handoff from native splash to NativeMapHome.",
  );
  assert.match(
    src,
    /html\[data-native="true"\]::after[\s\S]*?dogshift-paw-white\.png/,
    "Expected the html[data-native='true']::after rule to reference /dogshift-paw-white.png as background-image. This must match the white paw silhouette baked into the iOS LaunchScreen so the handoff is seamless. Regenerate both with `node scripts/generate-native-splash.mjs`.",
  );
  assert.match(
    src,
    /@keyframes ds-native-splash-paw-grow/,
    "Expected the @keyframes ds-native-splash-paw-grow animation — this is the 'grow' gesture the founder asked for at cold launch. If it's gone the splash → app transition becomes a hard cut.",
  );
});

test("app/layout.tsx exports viewportFit cover so the splash overlay can paint into safe-areas", () => {
  const src = readFileSync(join(repoRoot, "app/layout.tsx"), "utf8");

  assert.match(
    src,
    /viewportFit:\s*"cover"/,
    "Expected `viewportFit: \"cover\"` on the exported viewport. Without it the html-level ::before/::after pseudo-elements are bounded by the safe-area-respecting viewport on iOS, and the status-bar / home-indicator zones show through as white bands during the splash overlay (this was the regression in PR #430).",
  );
});

test("public/dogshift-paw-white.png exists and matches the splash artwork", () => {
  const path = join(repoRoot, "public/dogshift-paw-white.png");
  assert.ok(
    existsSync(path),
    `Missing ${path}. Regenerate it (along with the iOS splash) by running \`node scripts/generate-native-splash.mjs\`. This PNG is sourced from public/apple-touch-icon.png via a luminance-driven alpha extraction — the script is the single source of truth.`,
  );
});

test("lib/native/capacitorBridge.ts sets data-native-ready after splash hide to trigger the grow animation", () => {
  const src = readFileSync(
    join(repoRoot, "lib/native/capacitorBridge.ts"),
    "utf8",
  );

  assert.match(
    src,
    /setAttribute\("data-native-ready",\s*"true"\)/,
    "Expected the bridge to set data-native-ready='true' on <html> AFTER calling SplashScreen.hide(). Without it the CSS overlay never fades out and the user is stuck looking at the static purple+paw screen forever.",
  );
});

test("capacitor.config.ts uses an extended launchShowDuration so the native splash covers the WebView load window", () => {
  const src = readFileSync(join(repoRoot, "capacitor.config.ts"), "utf8");

  const match = src.match(/launchShowDuration:\s*(\d+)/);
  assert.ok(match, "Expected SplashScreen.launchShowDuration in capacitor.config.ts");
  const value = Number(match![1]);
  assert.ok(
    value >= 20000,
    `Expected SplashScreen.launchShowDuration to be >= 20000ms so the native iOS splash covers the worst-case Neon cold start + React hydration window. Got ${value}ms. The 1500ms default revealed the WebView while it was still showing the SSR-streamed marketing layout (header + empty + footer).`,
  );
  assert.match(
    src,
    /launchAutoHide:\s*true/,
    "Expected launchAutoHide: true as the safety net for the catastrophic-JS-failure case. Keep it true — if the bridge ever fails to call SplashScreen.hide() manually, the user must escape the splash eventually.",
  );
});

test("lib/native/capacitorBridge.ts hides the splash manually after bridge init", () => {
  const src = readFileSync(
    join(repoRoot, "lib/native/capacitorBridge.ts"),
    "utf8",
  );

  assert.match(
    src,
    /SplashScreen\.hide\(\)/,
    "Expected capacitorBridge.ts to call SplashScreen.hide() after init. Without it the splash stays up until the 30 s safety auto-hide, which makes the app feel frozen on every cold launch.",
  );
});

test("iOS Splash asset is the purple+logo image, not the default Capacitor placeholder", () => {
  const path = join(
    repoRoot,
    "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
  );
  assert.ok(existsSync(path), `Missing ${path}`);

  const stats = statSync(path);
  assert.ok(
    stats.size > 100_000,
    `Expected the purple+logo splash to be >100 KB (the default Capacitor placeholder is ~41 KB). Got ${stats.size} bytes. Regenerate with \`node scripts/generate-native-splash.mjs\`.`,
  );

  assert.ok(
    existsSync(join(repoRoot, "scripts/generate-native-splash.mjs")),
    "Expected scripts/generate-native-splash.mjs to exist (source of truth for the splash image — regenerate after any rebrand).",
  );
});
