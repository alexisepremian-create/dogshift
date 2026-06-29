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

test("requests skeleton uses REAL select/input (pixel-identical, no size jump)", () => {
  const src = read("components/native/SectionRouteSkeletons.tsx");
  // The placeholders must be actual form controls (same element = same 16px rule
  // + same autosizing as the real page), not <div>s that render text differently.
  assert.match(src, /<select[\s\S]*?<option>Tous<\/option>[\s\S]*?<\/select>/,
    "The 'Tous' placeholder must be a real <select> so its text size matches the page.");
  assert.match(src, /<input[\s\S]*?placeholder="Rechercher…"[\s\S]*?readOnly|readOnly[\s\S]*?placeholder="Rechercher…"/,
    "The 'Rechercher…' placeholder must be a real readonly <input> so its text size matches the page.");
});

test("messages skeleton includes the + FAB so it shows with the loading state", () => {
  const src = read("components/native/SectionRouteSkeletons.tsx");
  assert.match(src, /MessagesRouteSkeleton[\s\S]*?<Plus /,
    "MessagesRouteSkeleton must render the + FAB so it appears at the same time as the skeleton.");
  assert.match(src, /fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-\[#7c3aed\]/,
    "The skeleton FAB must match the real messages-layout FAB position/style.");
});

test("NativeBrandedLoader renders the splash as a cover background (no squished logo)", () => {
  const src = read("components/native/NativeBrandedLoader.tsx");
  assert.match(src, /native-splash\.png/, "Cover must reuse the launch splash image for a seamless match.");
  assert.match(src, /backgroundSize:\s*"cover"/, "The splash image must use background-size: cover to keep its aspect ratio.");
  assert.doesNotMatch(src, /width=\{92\}/, "Must not force the logo into a fixed 92px square (that squished it).");
});
