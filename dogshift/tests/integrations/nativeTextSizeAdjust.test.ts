/**
 * Regression test for docs/bugs/native-text-size-jump-on-arrival.md.
 *
 * On the native requests screen, the list rows + search field text visibly
 * "jumped bigger" on arrival. Root cause: the native typography rules
 * (`text-size-adjust: 100%` which disables WebKit font-boosting, and the 16px
 * field rule that prevents iOS focus-zoom) were scoped to `body[data-native]`.
 * `body[data-native]` is added a frame AFTER first paint by the useIsNativeApp
 * effect, whereas `html[data-native]` is stamped synchronously by the boot
 * script in app/layout.tsx. So for one frame WebKit boosted the text, then the
 * rule snapped it back — reading as the text growing.
 *
 * Fix: anchor these two rules to `html[data-native="true"]` so they apply on
 * the very first layout. This test locks that in.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

test("text-size-adjust is anchored to html[data-native] (synchronous), not body-only", () => {
  // The anti-font-boosting rule must target html (stamped at boot), so it is in
  // effect before the requests list paints.
  assert.match(
    css,
    /html\[data-native="true"\]\s*\{[^}]*text-size-adjust:\s*100%/,
    "Expected `html[data-native=\"true\"] { text-size-adjust: 100% }` so WebKit text inflation is disabled on first paint. Moving it back to body[data-native] only reintroduces the one-frame text-size jump on the requests screen.",
  );
});

test("the 16px no-zoom field rule is anchored to html[data-native] (synchronous)", () => {
  // The field font-size rule must also be html-scoped, otherwise the search
  // input flips 14px -> 16px a frame after mount (reads as the field growing).
  assert.match(
    css,
    /html\[data-native="true"\]\s+input[^{]*,\s*\n?\s*html\[data-native="true"\]\s+textarea,\s*\n?\s*html\[data-native="true"\]\s+select\s*\{[^}]*font-size:\s*16px/,
    "Expected the input/textarea/select 16px rule to be scoped to html[data-native] (synchronous boot attribute), not body[data-native] (added async by useIsNativeApp), so fields are 16px on first paint with no growth flip.",
  );
});
