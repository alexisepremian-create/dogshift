/**
 * Regression test for docs/bugs/native-tab-navigation-polish.md.
 *
 * Locks in the four end-to-end native polish fixes so a future refactor can't
 * silently undo any of them:
 *
 *   1. Onboarding/auth gate must NOT show when the user is already signed in.
 *   2. The map collapsed sheet hugs its content (no huge empty gap above nav).
 *   3. Tab switches never expose a purple body bg (slate reset after splash).
 *   4. Tab switches never show the full-screen running dog — group loaders
 *      route through NativeRouteFallback (native skeleton, web unchanged).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

test("NativeOnboarding never shows the intro when the session is authenticated", () => {
  const src = read("components/native/NativeOnboarding.tsx");
  assert.match(
    src,
    /status\s*===\s*"authenticated"[\s\S]*setShouldShow\(false\)/,
    "Expected NativeOnboarding to bail out (setShouldShow(false)) when status === 'authenticated' — a signed-in user must never see the onboarding/auth gate.",
  );
  assert.match(
    src,
    /\[isNative,\s*status,\s*markSeen\]/,
    "Expected the gating effect to depend on `status` so it re-evaluates once the session resolves.",
  );
});

test("NativeMapHome collapsed sheet hugs its content (not the old 212px overshoot)", () => {
  const src = read("components/native/NativeMapHome.tsx");
  assert.doesNotMatch(
    src,
    /"212px"|212px \+ 32px/,
    "Expected the 212px collapsed sheet height (which left a huge empty gap above the nav) to be gone.",
  );
  assert.match(
    src,
    /:\s*"148px"/,
    "Expected the collapsed sheet height to be ~148px so it hugs the single card row.",
  );
});

test("globals.css resets the native body background off purple after the splash", () => {
  const css = read("app/globals.css");
  // The splash-time purple fallback must remain…
  assert.match(
    css,
    /html\[data-native="true"\]\s+body\s*\{\s*background-color:\s*#7c3aed/,
    "Expected the purple body fallback during the splash to remain.",
  );
  // …but once ready, the body must become a neutral (non-purple) colour so a
  // null loading.tsx / force-dynamic refetch gap never flashes purple.
  assert.match(
    css,
    /html\[data-native="true"\]\[data-native-ready\]\s+body\s*\{\s*background-color:\s*#f1f5f9/,
    "Expected a [data-native-ready] body background reset to slate (#f1f5f9) so tab-switch gaps never show a purple screen.",
  );
});

test("route-group loaders route through NativeRouteFallback (no full-screen running dog on native)", () => {
  const protectedLoading = read("app/(protected)/loading.tsx");
  const marketingLoading = read("app/(marketing)/loading.tsx");

  assert.match(
    protectedLoading,
    /NativeRouteFallback\s+web="loader"/,
    "Expected (protected)/loading.tsx to use NativeRouteFallback (web='loader') — sitter tab switches must not show the running-dog PageLoader on native.",
  );
  assert.match(
    marketingLoading,
    /NativeRouteFallback\s+web="none"/,
    "Expected (marketing)/loading.tsx to use NativeRouteFallback (web='none') — owner tab switches must show a native skeleton, while web stays null for the e2e smoke test.",
  );
});

test("NativeRouteFallback: native → skeleton, web='none' → null, web='loader' → PageLoader", () => {
  const src = read("components/native/NativeRouteFallback.tsx");
  assert.match(
    src,
    /getAttribute\("data-native"\)\s*===\s*"true"/,
    "Expected NativeRouteFallback to read data-native synchronously (no first-render flash of the web loader).",
  );
  assert.match(
    src,
    /DashboardSkeleton/,
    "Expected the native branch to render a skeleton (instant, neutral) rather than a running dog or a blank.",
  );
  assert.match(
    src,
    /web\s*===\s*"loader"\s*\?\s*<PageLoader static \/>\s*:\s*null/,
    "Expected the web branch to preserve the prior behaviour: PageLoader for protected, null for marketing.",
  );
});

// ── Round 2 — follow-up polish ────────────────────────────────────────────

test("globals.css hides the running-dog nav overlay entirely on native", () => {
  const css = read("app/globals.css");
  assert.match(
    css,
    /html\[data-native="true"\]\s+#ds-nav-overlay\s*\{\s*display:\s*none\s*!important/,
    "Expected #ds-nav-overlay to be display:none on native — the founder must NEVER see the running dog in the app, not even a single flash.",
  );
});

test("DashboardSectionLoading shows a skeleton on native (never a blank page)", () => {
  const src = read("components/native/DashboardSectionLoading.tsx");
  assert.match(
    src,
    /getAttribute\("data-native"\)\s*===\s*"true"/,
    "Expected a synchronous data-native read (no first-frame web-loader flash).",
  );
  assert.match(
    src,
    /DashboardSkeleton/,
    "Expected the native branch to render a skeleton, not null — a blank white page during a force-dynamic load is the bug being fixed.",
  );
  assert.doesNotMatch(
    src,
    /if\s*\(isNative\)\s*return null/,
    "The old `return null` on native (blank page) must be gone.",
  );
});

test("NativeMapHome floors the bottom-nav offset so the sheet never hides under the nav", () => {
  const src = read("components/native/NativeMapHome.tsx");
  assert.match(
    src,
    /max\(var\(--ds-bottom-nav-h, 0px\), 88px\)/,
    "Expected a max(var(--ds-bottom-nav-h),88px) floor — when --ds-bottom-nav-h momentarily reads 0 on a tab return, the sheet must still clear the nav.",
  );
});

test("RequestsSplitView is full-width with no card on native", () => {
  const src = read("components/host/requests/RequestsSplitView.tsx");
  assert.match(src, /useIsNativeApp/, "Expected RequestsSplitView to branch on isNative.");
  assert.match(
    src,
    /isNative\s*\?\s*"w-full px-1 pb-12"/,
    "Expected the outer wrapper to be full-width on native (no max-w-6xl cap).",
  );
  assert.match(
    src,
    /isNative\s*\?\s*"px-1"\s*:\s*"rounded-3xl border/,
    "Expected the header card (rounded-3xl border bg) to be dropped on native — full-width, title flush left.",
  );
});

test("Host messages has a Conversations title + a purple + that starts a conversation", () => {
  const src = read("app/(protected)/host/messages/layout.tsx");
  assert.match(src, />\s*Conversations\s*</, "Expected a 'Conversations' title.");
  assert.match(
    src,
    /aria-label="Nouvelle conversation"/,
    "Expected the purple + button (aria-label 'Nouvelle conversation').",
  );
  assert.match(
    src,
    /bg-\[#7c3aed\]/,
    "Expected the + button to be brand purple (#7c3aed).",
  );
  assert.match(
    src,
    /conversations\/start/,
    "Expected the picker to POST to the start-conversation endpoint.",
  );
});

// ── Round 3 — bulletproof dog kill + FAB placement ────────────────────────

test("PageLoader renders a skeleton (not the running dog) on native", () => {
  const src = read("components/ui/PageLoader.tsx");
  assert.match(
    src,
    /getAttribute\("data-native"\)\s*===\s*"true"/,
    "Expected PageLoader to detect native synchronously.",
  );
  assert.match(
    src,
    /isNative\s*\?\s*\(\s*<div[\s\S]*?DashboardSkeleton[\s\S]*?\)\s*:\s*\(\s*<RunningDog/,
    "Expected native → <DashboardSkeleton/>, web → <RunningDog/>. This is the belt-and-suspenders layer so even loading.tsx that still use <PageLoader/> never show the dog in the app.",
  );
});

test("Conversations + button is a floating FAB anchored bottom-right above the nav", () => {
  const src = read("app/(protected)/host/messages/layout.tsx");
  assert.match(
    src,
    /className="fixed right-4 z-40[^"]*"/,
    "Expected the + to be a fixed bottom-right FAB (founder: 'le + en bas a droite au dessus de la nav barre').",
  );
  assert.match(
    src,
    /bottom:\s*"calc\(max\(var\(--ds-bottom-nav-h, 0px\), 88px\) \+ 16px\)"/,
    "Expected the FAB to sit above the bottom nav using the floored nav-height.",
  );
  // The + must no longer live in the header row next to the title.
  assert.doesNotMatch(
    src,
    /justify-between[\s\S]{0,80}Conversations[\s\S]{0,200}Nouvelle conversation/,
    "The + should have moved out of the header into the FAB.",
  );
});
