/**
 * Regression test for docs/bugs/native-app-footer-flash-on-launch.md.
 *
 * The fix has three independent layers that MUST all be present, otherwise
 * the Capacitor cold launch shows the marketing footer instead of the
 * native map home. This test asserts each layer's signature is still in the
 * source code. If a future refactor accidentally removes one, this test
 * fails immediately and CI blocks the merge.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("app/globals.css contains the native cold-launch overlay rule", () => {
  const src = readFileSync(join(repoRoot, "app/globals.css"), "utf8");

  assert.match(
    src,
    /html\[data-native="true"\]::before/,
    "Expected the purple cold-launch overlay rule (html[data-native='true']::before) in globals.css.",
  );
  assert.match(
    src,
    /html\[data-native="true"\]\[data-native-ready\]::before/,
    "Expected the overlay fade rule (html[data-native='true'][data-native-ready]::before) in globals.css. Without it the overlay never disappears and the user is stuck on a purple screen.",
  );
  assert.match(
    src,
    /html\[data-native="true"\] footer[\s\S]*display: none/,
    "Expected the native footer hide rule (html[data-native='true'] footer { display: none ... }) in globals.css.",
  );
});

test("lib/native/capacitorBridge.ts flips data-native-ready after bridge init", () => {
  const src = readFileSync(
    join(repoRoot, "lib/native/capacitorBridge.ts"),
    "utf8",
  );

  assert.match(
    src,
    /setAttribute\(\s*"data-native-ready"\s*,\s*"true"\s*\)/,
    "Expected capacitorBridge.ts to set data-native-ready='true' on documentElement once SplashScreen.hide() and status-bar init have resolved. Without it, the CSS overlay stays opaque forever in the native app.",
  );
});
