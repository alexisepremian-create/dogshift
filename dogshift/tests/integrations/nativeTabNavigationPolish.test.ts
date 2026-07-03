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
    /NativeRouteFallback\s+web="spacer"/,
    "Expected (marketing)/loading.tsx to use NativeRouteFallback (web='spacer') — owner tab switches show a native skeleton; on web a full-height spacer reserves space so the homepage footer doesn't collapse to the top during the streaming DB read.",
  );
});

test("NativeRouteFallback: native → skeleton, web spacer reserves height (no PageLoader on marketing)", () => {
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
    /web\s*===\s*"loader"\)\s*return\s*<PageLoader static \/>/,
    "Expected the protected web fallback to keep PageLoader (running dog).",
  );
  assert.match(
    src,
    /web\s*===\s*"spacer"\)\s*return\s*<div[^>]*min-h-screen/,
    "Expected the marketing web fallback to be a full-height SPACER (reserves a viewport so the footer stays below the fold during the homepage streaming SSR).",
  );
  // Guard the e2e-smoke invariant: the marketing/web fallback must NOT carry a
  // PageLoader / data-page-loader marker (it would hide header+footer via the
  // footer-flash CSS → <100 char body on cold-Neon previews → smoke fails).
  assert.doesNotMatch(
    src,
    /data-page-loader/,
    "The marketing web fallback must not introduce a data-page-loader marker — see docs/bugs/homepage-footer-flash-initial-load.md.",
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

test("route fallbacks: map skeleton on home, matched section skeletons on dashboards (never a blank)", () => {
  const fallback = read("components/native/NativeRouteFallback.tsx");
  assert.match(fallback, /usePathname/, "Expected NativeRouteFallback to branch on the pathname.");
  assert.match(
    fallback,
    /pathname\s*===\s*"\/"\s*\)\s*return\s*<MapHomeSkeleton/,
    "Expected the home route ('/') to render <MapHomeSkeleton/> (matches NativeMapHome, both fixed inset-0).",
  );
  // The host/account layouts are force-dynamic + SLOW, so the fallback is on
  // screen for a real moment — it MUST be a skeleton, never null (null painted
  // a white screen = the regression we undid).
  assert.match(
    fallback,
    /\/host\/requests[\s\S]*?<RequestsRouteSkeleton/,
    "Expected /host/requests to render the matched Réservations skeleton (not null).",
  );
  assert.match(
    fallback,
    /\/host\/messages[\s\S]*?<MessagesRouteSkeleton/,
    "Expected /host/messages to render the matched Conversations skeleton (not null).",
  );

  const map = read("components/native/MapHomeSkeleton.tsx");
  assert.match(map, /fixed inset-0 z-0/, "MapHomeSkeleton must sit below the z-50 nav so the nav stays visible.");
  assert.match(map, /Lieu, dates, service/, "MapHomeSkeleton must replicate the real search pill text.");
  assert.match(map, /Chargement…/, "MapHomeSkeleton must replicate the sheet's 'Chargement…' header.");

  const section = read("components/native/SectionRouteSkeletons.tsx");
  assert.match(
    section,
    /fixed inset-0 z-40 w-full overflow-y-auto bg-white/,
    "Section replicas must be a fixed inset-0 overlay (below the nav) so they cover the transition gap / map teardown instantly — no white flash.",
  );
  assert.match(section, /w-full py-3/, "Section replicas must include the shell's inner py-3 so the position matches.");
});

test("home: the web marketing homepage is hidden on native so it never flashes before the map", () => {
  const css = read("app/globals.css");
  assert.match(
    css,
    /html\[data-native="true"\]\s+\[data-ds-web-home\]\s*\{\s*display:\s*none\s*!important/,
    "Expected a CSS rule hiding [data-ds-web-home] on native so the web hero never paints before NativeMapHome.",
  );
  const sw = read("components/native/NativeHomeSwitch.tsx");
  assert.match(sw, /data-ds-web-home/, "Expected NativeHomeSwitch to tag the web homepage with data-ds-web-home.");
});

test("dashboard gates render a skeleton (not null=white) while waiting", () => {
  // HostHydrationGate + HostDataGate wrap the shell and used to `return null`
  // (= a white screen) during their hydration / data-ready wait windows — that
  // white appeared AFTER the route fallback and was the real navigation flash.
  const hydration = read("components/HostHydrationGate.tsx");
  assert.match(
    hydration,
    /if\s*\(!ready\)\s*return\s*<NativeDashboardLoading/,
    "HostHydrationGate must render <NativeDashboardLoading/> (not null) before hydration.",
  );
  const dataGate = read("components/HostDataGate.tsx");
  assert.match(
    dataGate,
    /if\s*\(waiting\)\s*\{[\s\S]*?return\s*<NativeDashboardLoading/,
    "HostDataGate must render <NativeDashboardLoading/> (not null) while waiting.",
  );
  // The gate skeleton must be a fixed overlay (covers the gap) on native, null on web.
  const gateLoader = read("components/native/NativeDashboardLoading.tsx");
  assert.match(gateLoader, /getAttribute\("data-native"\)\s*===\s*"true"/, "NativeDashboardLoading must detect native synchronously.");
  assert.match(gateLoader, /if\s*\(!isNative\)\s*return null/, "NativeDashboardLoading must return null on web (gates' prior behaviour off-app).");
  assert.match(gateLoader, /RequestsRouteSkeleton|fixed inset-0 z-40/, "NativeDashboardLoading must render the matched native skeleton overlay.");
});

test("sitter dashboard root shows ONE skeleton across EVERY boundary (route group → route → gate → page)", () => {
  // The chain to /host crosses 4 Suspense/gate boundaries. Each used to render a
  // DIFFERENT skeleton (generic ui/DashboardSkeleton at the route-group + route +
  // gate, faithful local one at the page), so the user saw several skeletons
  // flash in sequence. Every boundary must now render the SAME faithful skeleton:
  //  - route group  (NativeRouteFallback, /host branch) → HostDashboardSkeletonOverlay
  //  - route        (host/loading.tsx, native)          → HostDashboardSkeletonOverlay
  //  - gates        (NativeDashboardLoading, /host)      → HostDashboardSkeletonOverlay
  //  - page         (/host page)                         → HostDashboardSkeleton (bare, in-shell)
  // The overlay's padding mirrors the shell <main> so it lands in the exact same
  // spot as the page's bare skeleton — one continuous shape, no shift.
  const shared = read("components/HostDashboardSkeleton.tsx");
  assert.match(shared, /export default function HostDashboardSkeleton/, "HostDashboardSkeleton must be a shared component.");
  assert.match(shared, /data-testid="host-dashboard-skeleton"/, "It must be the faithful host-dashboard replica.");

  const overlay = read("components/native/HostDashboardSkeletonOverlay.tsx");
  assert.match(overlay, /<HostDashboardSkeleton \/>/, "HostDashboardSkeletonOverlay must wrap the faithful skeleton.");
  assert.match(
    overlay,
    /paddingTop:[\s\S]*?env\(safe-area-inset-top[\s\S]*?0\.5rem \+ 0\.25rem/,
    "The overlay must pad to land where the in-shell page skeleton sits (main pt + inner pt-1).",
  );

  const page = read("app/(protected)/host/page.tsx");
  assert.match(page, /return <HostDashboardSkeleton \/>/, "/host page must render the shared skeleton (not a local one).");
  assert.doesNotMatch(page, /function DashboardSkeleton\(/, "The local DashboardSkeleton duplicate must be gone.");

  for (const [file, label] of [
    ["components/native/NativeRouteFallback.tsx", "route-group fallback"],
    ["app/(protected)/host/loading.tsx", "route fallback"],
    ["components/native/NativeDashboardLoading.tsx", "dashboard gates"],
  ] as const) {
    const src = read(file);
    assert.match(src, /HostDashboardSkeletonOverlay/, `${label} (${file}) must render HostDashboardSkeletonOverlay for /host.`);
  }
  // The two pathname-aware boundaries must gate the overlay on the /host root.
  assert.match(read("components/native/NativeRouteFallback.tsx"), /pathname === "\/host"[\s\S]*?HostDashboardSkeletonOverlay/, "NativeRouteFallback must use the overlay for the /host root.");
  assert.match(read("components/native/NativeDashboardLoading.tsx"), /pathname === "\/host"[\s\S]*?HostDashboardSkeletonOverlay/, "NativeDashboardLoading must use the overlay for the /host root.");
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

test("dashboard shell + requests read native synchronously (no web-layout flash)", () => {
  // The shell hides its logo header on native, and RequestsSplitView drops its
  // card — both must be correct on the FIRST render, else the WEB layout (logo +
  // card) flashes before flipping. They render behind HostHydrationGate so a
  // synchronous read is hydration-safe.
  const shell = read("components/HostDashboardShell.tsx");
  assert.match(shell, /useIsNativeAppSync/, "HostDashboardShell must use the synchronous native hook.");
  assert.doesNotMatch(shell, /from "@\/lib\/native\/useIsNativeApp"/, "HostDashboardShell must not use the async useIsNativeApp (causes a web-layout flash).");
  const requests = read("components/host/requests/RequestsSplitView.tsx");
  assert.match(requests, /useIsNativeAppSync/, "RequestsSplitView must use the synchronous native hook.");
  const hook = read("lib/native/useIsNativeAppSync.ts");
  assert.match(hook, /getAttribute\("data-native"\)\s*===\s*"true"/, "useIsNativeAppSync must read data-native synchronously.");
});

test("bottom nav persists isSitter so it doesn't flip owner→sitter at launch", () => {
  const nav = read("components/native/GlobalNativeBottomNav.tsx");
  assert.match(
    nav,
    /useState<boolean>\(\(\)\s*=>[\s\S]*?ds_is_sitter/,
    "GlobalNativeBottomNav must seed isSitter from the persisted ds_is_sitter flag (no calendar→inbox flip at launch).",
  );
  assert.match(
    nav,
    /setItem\("ds_is_sitter"/,
    "It must persist ds_is_sitter after resolving the account context.",
  );
});

test("NativeMapHome sheet: swipe + click-outside + blur + hidden locate + price + best-rated first", () => {
  const src = read("components/native/NativeMapHome.tsx");
  // Drag to open/close the sheet via the grab handle — follows the finger 1:1
  // (live height) then snaps on release.
  assert.match(src, /onTouchStart=\{onHandleTouchStart\}/, "Sheet handle must wire onTouchStart for drag.");
  assert.match(src, /onHandleTouchMove[\s\S]*?setSheetDragH\(/, "Drag must track the sheet height live (setSheetDragH).");
  assert.match(src, /onHandleTouchEnd[\s\S]*?setSheetOpen\(shouldOpen\)/, "Release must snap the sheet open/closed.");
  assert.match(src, /height:\s*sheetDragH != null \?/, "The sheet height must follow the live drag value.");
  // Tap outside (scrim) closes; map is blurred while open.
  assert.match(src, /aria-label="Fermer la liste"[\s\S]*?onClick=\{\(\) => setSheetOpen\(false\)\}/, "A full-screen scrim must close the sheet on tap-outside.");
  assert.match(src, /filter:\s*sheetOpen\s*\?\s*"blur\(/, "The map container must blur while the sheet is open.");
  // Locate FAB hidden while the sheet is open.
  assert.match(src, /\{!sheetOpen && \([\s\S]*?aria-label="Me localiser"/, "The locate FAB must be hidden while the sheet is open.");
  // Price shown on the cards.
  assert.match(src, /CHF \$\{s\.minPrice\}|dès \$\{s\.minPrice\} CHF/, "Sitter cards must show the starting price.");
  // Default order = best-rated first.
  assert.match(
    src,
    /sort\(\(a, b\) => \(b\.rating \?\? 0\) - \(a\.rating \?\? 0\) \|\| b\.reviews - a\.reviews\)/,
    "Default sitter order must be best-rated first (then most-reviewed).",
  );
});

test("NativeMapHome: rating sits next to the name, price on its own line (never truncated)", () => {
  const src = read("components/native/NativeMapHome.tsx");
  // Name + star rating share one flex row…
  assert.match(
    src,
    /<span className="truncate text-sm font-semibold text-slate-900">\s*\{s\.name\}\s*<\/span>\s*\{s\.rating !== null && \([\s\S]*?\{s\.rating\.toFixed\(1\)\}/,
    "The sitter card must render the star rating on the SAME row as the name.",
  );
  // …and the price gets its OWN line (so it can't be cut off by the rating).
  assert.match(
    src,
    /\{s\.minPrice > 0 && \(\s*<div className=\{`mt-0\.5 truncate text-xs font-medium text-slate-700/,
    "The price must be on its own dedicated line below the name/city.",
  );
});

test("NativeMapHome locate button uses the native Geolocation plugin (WKWebView has no navigator.geolocation)", () => {
  const src = read("components/native/NativeMapHome.tsx");
  assert.match(
    src,
    /import\("@capacitor\/geolocation"\)/,
    "handleLocate must use @capacitor/geolocation natively — WKWebView never fires navigator.geolocation.",
  );
  assert.match(src, /Geolocation\.requestPermissions\(\)/, "It must request location permission on native.");
  assert.match(src, /Geolocation\.getCurrentPosition/, "It must read the position via the plugin on native.");
  // Web still falls back to the browser API.
  assert.match(src, /navigator\.geolocation\.getCurrentPosition/, "Web must keep the navigator.geolocation fallback.");
  // The native plugin needs the iOS usage-description or Core Location aborts.
  assert.match(
    read("ios/App/App/Info.plist"),
    /NSLocationWhenInUseUsageDescription/,
    "Info.plist must declare NSLocationWhenInUseUsageDescription for the Geolocation plugin.",
  );
});

test("NativeMapHome search/filter panel is floored above the nav", () => {
  const src = read("components/native/NativeMapHome.tsx");
  assert.match(
    src,
    /bottom:\s*"calc\(max\(var\(--ds-bottom-nav-h, 0px\), 88px\) \+ 20px\)"/,
    "Expected the search/filter panel bottom to sit above the nav + centre paw (floored nav-height + clearance).",
  );
});
