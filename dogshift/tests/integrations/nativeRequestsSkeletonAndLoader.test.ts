/**
 * Regression tests for the native Réservations tab polish:
 *   1. The most-specific /host/requests + /host/messages loading boundaries must
 *      render the faithful pathname-aware skeleton (NativeRouteFallback), not a
 *      generic DashboardSkeleton — otherwise the tab load doesn't match the real
 *      layout (founder: "le skeleton doit être formé de la même manière que ce
 *      qui va apparaître").
 *   2. The requests skeleton's Tous/Rechercher placeholders must be text-base
 *      (16px) to MATCH the real <select>/<input> (forced to 16px by the native
 *      no-zoom rule) — otherwise the text jumps 14px→16px on load ("le texte qui
 *      grossit").
 *   3. NativeBrandedLoader must render the splash image as a `cover` background,
 *      not a fixed-size square <img> that squished the logo ("le logo est
 *      compressé").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

test("requests + messages loading boundaries use the faithful NativeRouteFallback", () => {
  for (const rel of [
    "app/(protected)/host/requests/loading.tsx",
    "app/(protected)/host/messages/loading.tsx",
  ]) {
    const src = read(rel);
    assert.match(src, /NativeRouteFallback/, `${rel} must render NativeRouteFallback (faithful skeleton).`);
    assert.doesNotMatch(
      src,
      /return\s*<DashboardSkeleton\s*\/>/,
      `${rel} must NOT render the generic DashboardSkeleton directly — it doesn't match the real layout.`,
    );
  }
});

test("requests skeleton sizes Tous/Rechercher at 16px to match the real inputs", () => {
  const src = read("components/native/SectionRouteSkeletons.tsx");
  // The Tous + Rechercher placeholder rows must be text-base (16px), not text-sm.
  assert.match(src, /pl-3 pr-8 text-base font-semibold text-slate-700 shadow-sm md:w-\[140px\][^]*?Tous/,
    "The 'Tous' placeholder must be text-base (16px) to match the real <select>.");
  assert.match(src, /pl-10 pr-3 text-base text-slate-400 shadow-sm[^]*?Rechercher/,
    "The 'Rechercher…' placeholder must be text-base (16px) to match the real <input>.");
});

test("NativeBrandedLoader renders the splash as a cover background (no squished logo)", () => {
  const src = read("components/native/NativeBrandedLoader.tsx");
  assert.match(src, /native-splash\.png/, "Cover must reuse the launch splash image for a seamless match.");
  assert.match(src, /backgroundSize:\s*"cover"/, "The splash image must use background-size: cover to keep its aspect ratio.");
  assert.doesNotMatch(src, /width=\{92\}/, "Must not force the logo into a fixed 92px square (that squished it).");
});
