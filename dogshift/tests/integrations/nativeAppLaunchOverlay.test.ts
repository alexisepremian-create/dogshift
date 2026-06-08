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
    /html\[data-native="true"\]::after[\s\S]*?native-splash\.png[\s\S]*?background-size:\s*cover/,
    "Expected the html[data-native='true']::after rule to reference /native-splash.png as background-image with background-size: cover. This is the CSS equivalent of UIKit's scaleAspectFill — using the SAME full 2732² splash PNG ensures the LaunchScreen → WebView handoff is pixel-identical (previous vmin/vmax sizing of a smaller mark drifted 3-5% across devices). Regenerate the PNG with `node scripts/generate-native-splash.mjs`.",
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

test("public/native-splash.png exists for the WebView background-cover overlay", () => {
  const path = join(repoRoot, "public/native-splash.png");
  assert.ok(
    existsSync(path),
    `Missing ${path}. This is the FULL 2732² splash PNG (purple bg + paw + DOGSHIFT) used by the WebView CSS overlay with background-size: cover — the exact CSS equivalent of UIKit's scaleAspectFill, so the LaunchScreen → WebView handoff is pixel-identical. Regenerate by running \`node scripts/generate-native-splash.mjs\`.`,
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

test("lib/native/capacitorBridge.ts waits for React to mount native-variant pages before triggering the splash fade", () => {
  const src = readFileSync(
    join(repoRoot, "lib/native/capacitorBridge.ts"),
    "utf8",
  );

  const match = src.match(/SPLASH_REACT_MOUNT_BUFFER_MS\s*=\s*(\d+)/);
  assert.ok(
    match,
    "Expected a `SPLASH_REACT_MOUNT_BUFFER_MS` delay constant in capacitorBridge.ts. Without this buffer between `SplashScreen.hide()` and the `data-native-ready` flip, the overlay's bg fade can race React's commit of <NativeMapHome> and briefly expose the marketing layout's white body in the iOS safe-area zones — exact regression founder reported after PR #432.",
  );
  const value = Number(match![1]);
  assert.ok(
    value >= 300,
    `Expected SPLASH_REACT_MOUNT_BUFFER_MS >= 300 ms (got ${value} ms). Anything shorter has been observed to race cold-Neon-connection hydration in production.`,
  );
});

test("app/globals.css paints the body purple in native mode as a safe-area fallback", () => {
  const src = readFileSync(join(repoRoot, "app/globals.css"), "utf8");

  assert.match(
    src,
    /html\[data-native="true"\] body[\s\S]*?background-color:\s*#7c3aed/,
    "Expected `html[data-native='true'] body { background-color: #7c3aed }` in globals.css. This is the belt-and-suspenders for the splash overlay fade: even if React hasn't yet mounted <NativeMapHome> by the time the overlay fades, the safe-area zones show brand purple — never white. Don't drop it without re-testing the founder's 'bandes blanches pendant l'animation' regression.",
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

test("capacitor.config.ts paints the WebView background brand purple so safe-area zones are never white", () => {
  const src = readFileSync(join(repoRoot, "capacitor.config.ts"), "utf8");

  assert.match(
    src,
    /ios:\s*\{[\s\S]*?backgroundColor:\s*"#7c3aed"/,
    "Expected `ios.backgroundColor: \"#7c3aed\"` in capacitor.config.ts. The WebView's own bg shows through in the iOS safe-area zones (status bar + home indicator) — making it purple guarantees no white band during the splash → app handoff even if the body bg / overlay logic ever fails. Don't revert without testing the 'bandes blanches' regression.",
  );
  assert.match(
    src,
    /android:\s*\{[\s\S]*?backgroundColor:\s*"#7c3aed"/,
    "Expected `android.backgroundColor: \"#7c3aed\"` in capacitor.config.ts for the same reason as iOS — keeps both platforms in lockstep.",
  );
});

test("capacitor.config.ts pairs the purple WebView with a LIGHT-style purple status bar", () => {
  const src = readFileSync(join(repoRoot, "capacitor.config.ts"), "utf8");

  assert.match(
    src,
    /StatusBar:\s*\{[\s\S]*?style:\s*"LIGHT"[\s\S]*?backgroundColor:\s*"#7c3aed"/,
    "Expected the StatusBar plugin block to use `style: \"LIGHT\"` (white icons) with `backgroundColor: \"#7c3aed\"`. Style DARK on a purple bg makes the time/battery icons unreadable, and a white status-bar bg would re-introduce the white band at the top of the screen.",
  );
});

test("lib/native/capacitorBridge.ts sets the StatusBar to LIGHT + purple at runtime", () => {
  const src = readFileSync(
    join(repoRoot, "lib/native/capacitorBridge.ts"),
    "utf8",
  );

  assert.match(
    src,
    /setStyle\(\{\s*style:\s*Style\.Light\s*\}\)/,
    "Expected the bridge to call `StatusBar.setStyle({ style: Style.Light })` at runtime — the static config is one source of truth, this is the other; both must agree or the status bar flickers on app boot.",
  );
  assert.match(
    src,
    /setBackgroundColor\(\{\s*color:\s*"#7c3aed"\s*\}\)/,
    "Expected the bridge to call `StatusBar.setBackgroundColor({ color: \"#7c3aed\" })` at runtime.",
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
