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
  // …but once ready, the body must become WHITE (matches the dashboards) so the
  // 1-frame route-fallback→page swap gap is invisible — never purple, never a
  // slate→white flash on navigation.
  assert.match(
    css,
    /html\[data-native="true"\]\[data-native-ready\]\s+body\s*\{\s*background-color:\s*#ffffff/,
    "Expected a [data-native-ready] body background reset to white (#ffffff) so navigation gaps never flash against the white dashboards.",
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
    /if\s*\(isNative\)\s*\{[\s\S]*?className="w-full px-3"[\s\S]*?<DashboardSkeleton\s*\/>[\s\S]*?\}/,
    "Expected native → an IN-FLOW DashboardSkeleton (className 'w-full px-3', not a fixed full-screen overlay) so the bottom nav stays visible during loading.",
  );
  assert.match(src, /<RunningDog/, "Expected web to keep the running dog.");
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

// ── Round 4 — clean loading behaviour: grey glide skeletons, coherent shapes ─

test("skeleton shimmer is a neutral GREY glide (not violet)", () => {
  const css = read("app/globals.css");
  assert.match(css, /@keyframes\s+dsSkelGlide/, "Expected a dsSkelGlide animation.");
  assert.match(
    css,
    /\.ds-skel\s*\{[\s\S]*?#e2e8f0[\s\S]*?\}/,
    "Expected the .ds-skel base to be slate-200 grey (#e2e8f0) — founder asked for grey, violet was 'moche'.",
  );
  assert.doesNotMatch(
    css,
    /\.ds-skel\s*\{[\s\S]*?(167,\s*139,\s*250|139,\s*92,\s*246|#ede9fe)[\s\S]*?\}/,
    "The violet skeleton must be gone.",
  );
});

test("DashboardSkeleton uses the grey .ds-skel shimmer (no violet borders)", () => {
  const src = read("components/ui/DashboardSkeleton.tsx");
  assert.match(src, /ds-skel/, "Expected DashboardSkeleton to use the .ds-skel class.");
  assert.doesNotMatch(src, /violet-100/, "The violet card borders must be gone (grey only).");
});

test("RequestsSplitView + messages loading states use the .ds-skel shimmer", () => {
  const requests = read("components/host/requests/RequestsSplitView.tsx");
  const messages = read("app/(protected)/host/messages/layout.tsx");
  assert.match(requests, /ds-skel/, "Expected the requests loading list to use the skeleton class.");
  assert.doesNotMatch(
    requests,
    /bg-slate-100\/80 animate-pulse/,
    "The old grey pulse skeleton in the requests loading list must be gone.",
  );
  assert.match(messages, /ds-skel/, "Expected the conversations loading list to use the skeleton class.");
});

test("route fallbacks are pathname-aware faithful replicas (one continuous skeleton)", () => {
  const fallback = read("components/native/NativeRouteFallback.tsx");
  assert.match(fallback, /usePathname/, "Expected NativeRouteFallback to branch on the pathname.");
  assert.match(
    fallback,
    /pathname\s*===\s*"\/"\s*\)\s*return\s*<MapHomeSkeleton/,
    "Expected the home route ('/') to render <MapHomeSkeleton/> (map + sitter preview).",
  );
  assert.match(
    fallback,
    /\/host\/requests[\s\S]*?<RequestsRouteSkeleton/,
    "Expected /host/requests to render the Réservations replica skeleton.",
  );
  assert.match(
    fallback,
    /\/host\/messages[\s\S]*?<MessagesRouteSkeleton/,
    "Expected /host/messages to render the Conversations replica skeleton.",
  );

  const map = read("components/native/MapHomeSkeleton.tsx");
  assert.match(map, /fixed inset-0 z-0/, "MapHomeSkeleton must sit below the z-50 nav so the nav stays visible.");
  // Faithful replica markers: same chrome + 'Chargement…' loading sheet as NativeMapHome.
  assert.match(map, /Lieu, dates, service/, "MapHomeSkeleton must replicate the real search pill text.");
  assert.match(map, /Chargement…/, "MapHomeSkeleton must replicate the sheet's 'Chargement…' header.");

  const section = read("components/native/SectionRouteSkeletons.tsx");
  assert.match(section, />\s*Réservations\s*</, "Requests replica must show the real 'Réservations' title.");
  assert.match(section, />\s*Conversations\s*</, "Messages replica must show the real 'Conversations' title.");
  assert.match(section, /Rechercher…/, "Requests replica must replicate the search box.");
  // Dashboard replicas must paint a white bg matching the shell, so the
  // route→page hand-off doesn't flash the slate body background.
  assert.match(section, /min-h-screen w-full bg-white/, "Section replicas must paint bg-white to match the dashboard shell.");
});

test("route + section fallbacks pad the bottom so the skeleton never spills under the nav", () => {
  for (const f of [
    "components/native/NativeRouteFallback.tsx",
    "components/native/DashboardSectionLoading.tsx",
    "components/ui/PageLoader.tsx",
  ]) {
    assert.match(
      read(f),
      /paddingBottom:\s*"calc\(max\(var\(--ds-bottom-nav-h, 0px\), 88px\) \+ 24px\)"/,
      `Expected ${f} to floor its bottom padding above the nav.`,
    );
  }
});

test("NativeMapHome search/filter panel is floored above the nav", () => {
  const src = read("components/native/NativeMapHome.tsx");
  assert.match(
    src,
    /bottom:\s*"calc\(max\(var\(--ds-bottom-nav-h, 0px\), 88px\) \+ 8px\)"/,
    "Expected the search/filter panel bottom to use the floored nav-height so it never slips under the nav.",
  );
});
