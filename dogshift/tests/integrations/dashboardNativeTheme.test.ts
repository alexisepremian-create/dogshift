/**
 * Guards the native (Capacitor) dashboard theme:
 *   - purple accent in the native app / navy on web (scoped CSS custom-property
 *     override on the dashboard subtree),
 *   - compact cards/rows in native via marker classes (ds-card / ds-stat /
 *     ds-row) driven by scoped CSS so it works in both server- and
 *     client-rendered dashboard pages.
 *
 * All string-level so it stays fast and has no DOM deps. The web site must be
 * untouched — the overrides are all scoped to `html[data-native="true"]`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("globals.css flips the dashboard accent to purple in native only", () => {
  const css = read("app/globals.css");
  // Scoped to the native app + the dashboard subtree (not global).
  assert.match(
    css,
    /html\[data-native="true"\]\s+\[data-ds-dashboard\]\s*\{[^}]*--dogshift-blue:\s*#7c3aed/,
    "Native dashboard must override --dogshift-blue to purple #7c3aed.",
  );
  assert.match(
    css,
    /html\[data-native="true"\]\s+\[data-ds-dashboard\]\s*\{[^}]*--dogshift-blue-hover:\s*#6d28d9/,
    "Native dashboard must override the hover accent too.",
  );
  // The base (web) value stays navy.
  assert.match(css, /--dogshift-blue:\s*#2f4d6b/, "Web accent must stay navy.");
});

test("globals.css compacts dashboard cards/rows in native via marker classes", () => {
  const css = read("app/globals.css");
  for (const marker of ["ds-card", "ds-stat", "ds-row"]) {
    assert.match(
      css,
      new RegExp(`html\\[data-native="true"\\]\\s+\\[data-ds-dashboard\\]\\s+\\.${marker}\\s*\\{[^}]*padding`),
      `Native dashboard must compact .${marker} via a scoped padding rule.`,
    );
  }
});

test("both dashboard shells carry the data-ds-dashboard scope", () => {
  for (const shell of ["components/OwnerDashboardShell.tsx", "components/HostDashboardShell.tsx"]) {
    assert.match(read(shell), /data-ds-dashboard/, `${shell} must render data-ds-dashboard on its root.`);
  }
});

test("dashboard pages carry the compaction markers", () => {
  // Sitter home + owner home are the flagship pages.
  assert.match(read("app/(protected)/host/page.tsx"), /ds-stat rounded-3xl/, "Sitter home stat cards must be marked.");
  assert.match(read("app/(protected)/host/page.tsx"), /ds-card rounded-3xl/, "Sitter home sections must be marked.");
  assert.match(read("app/(marketing)/account/page.tsx"), /ds-card relative isolate/, "Owner home content card must be marked.");
});

test("globals.css swaps native vs web dashboard homes", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.ds-native-only\s*\{\s*display:\s*none/, "Native dashboard is hidden by default (web).");
  assert.match(css, /html\[data-native="true"\]\s+\.ds-native-only\s*\{\s*display:\s*block/, "Native dashboard shows in the app.");
  assert.match(css, /html\[data-native="true"\]\s+\.ds-web-only\s*\{\s*display:\s*none/, "Web dashboard hides in the app.");
});

test("both homes mount a native island behind ds-native-only, web behind ds-web-only", () => {
  const sitter = read("app/(protected)/host/page.tsx");
  const owner = read("app/(marketing)/account/page.tsx");
  assert.match(sitter, /ds-native-only[\s\S]{0,120}<HostNativeHome/, "Sitter native branch must mount HostNativeHome.");
  assert.match(owner, /ds-native-only[\s\S]{0,160}<OwnerNativeHome/, "Owner native branch must mount OwnerNativeHome.");
  assert.match(sitter, /ds-web-only[^"]*"\s+data-testid="host-dashboard"/, "Sitter web dashboard must be gated ds-web-only.");
  assert.match(owner, /ds-web-only[^"]*"\s+data-testid="account-dashboard"/, "Owner web dashboard must be gated ds-web-only.");
});

test("NativeDashTile primary variant is purple and supports an onClick (button) mode", () => {
  const tile = read("components/native/NativeDashTile.tsx");
  assert.match(tile, /variant === "primary"[\s\S]*bg-\[#7c3aed\]/, "Primary tile must be purple #7c3aed.");
  assert.match(tile, /if \(onClick\)[\s\S]*<button/, "Tile must render a <button> when onClick is provided.");
});

test("DashboardSheet is a slide-up overlay with a back header", () => {
  const sheet = read("components/native/DashboardSheet.tsx");
  assert.match(sheet, /"use client"/, "DashboardSheet must be a client component.");
  assert.match(sheet, /z-\[1201\]/, "Sheet must sit above the dashboard.");
  assert.match(sheet, /aria-label="Retour"/, "Sheet must have a back button.");
  // Floating geometry identical to the reservation fiche (not edge-to-edge).
  assert.match(sheet, /fixed left-2 right-2 z-\[1201\][\s\S]*rounded-3xl/, "Sheet must float with side margins + rounded corners.");
  assert.match(sheet, /env\(safe-area-inset-top, 0px\) \+ 70px/, "Sheet top must match the reservation fiche offset.");
  assert.match(sheet, /aria-label="Fermer"/, "Sheet must also have a ✕ close button.");
});

test("native tab bar is solid/edge-to-edge with a center DogShift logo that opens the menu", () => {
  const bar = read("components/native/NativeTabBar.tsx");
  assert.match(bar, /"use client"/, "NativeTabBar must be a client component.");
  // Solid bar anchored to the bottom — NOT the floating rounded pill.
  assert.match(bar, /border-t border-slate-200 bg-white/, "Bar must be a solid edge-to-edge bar (border-top, white).");
  assert.doesNotMatch(bar, /rounded-\[24px\][\s\S]*backdrop-blur-xl/, "Must not reuse the floating frosted pill.");
  // Center raised real DogShift logo (the app icon) opens the more sheet, full purple, no white ring.
  assert.match(bar, /apple-touch-icon\.png/, "Center button must use the real DogShift app-icon logo.");
  assert.doesNotMatch(bar, /ring-4 ring-white/, "Center logo must be full purple, no white ring.");
  assert.match(bar, /setMoreOpen\(\(v\) => !v\)/, "Center logo must toggle the more menu.");
  // Sliding purple pill behind the active tab (animated between tabs).
  assert.match(bar, /absolute inset-y-\[8px\][\s\S]*bg-\[#7c3aed\]/, "Active tab must have a purple pill.");
  assert.match(bar, /transition: "left 320ms/, "The pill must slide between tabs.");
  // White fills through the safe area so the map never shows below the bar.
  assert.match(bar, /bg-white[\s\S]*paddingBottom: "env\(safe-area-inset-bottom\)"/, "Bar white bg must extend through the safe area.");
  // Sets the shared nav-height var so content spacing stays correct.
  assert.match(bar, /--ds-bottom-nav-h/, "NativeTabBar must publish the nav height var.");
});

test("GlobalNativeBottomNav uses NativeTabBar with a person→dashboard tab", () => {
  const nav = read("components/native/GlobalNativeBottomNav.tsx");
  assert.match(nav, /<NativeTabBar /, "Native nav must render the new NativeTabBar.");
  assert.doesNotMatch(nav, /<MobileBottomNav /, "Native nav must no longer use the floating MobileBottomNav.");
  assert.match(nav, /key: "dashboard"[\s\S]*<User /, "A person icon must be a primary tab → dashboard.");
  assert.match(nav, /href: "\/host", icon: <User /, "Sitter person tab → /host.");
  assert.match(nav, /href: "\/account", icon: <User /, "Owner person tab → /account.");
});

test("native host skeleton drops the yellow gradient + matches the new home", () => {
  const skel = read("components/HostDashboardSkeleton.tsx");
  assert.match(skel, /function HostNativeSkeleton/, "A native skeleton variant must exist.");
  assert.match(skel, /useIsNativeAppSync\(\)/, "Skeleton must branch on native.");
  assert.match(skel, /if \(isNative\) return <HostNativeSkeleton/, "Native must render the native skeleton (no SunCornerGlow/yellow).");
  // The native skeleton block must not carry the warm gradient.
  const nativeBlock = skel.slice(skel.indexOf("function HostNativeSkeleton"), skel.indexOf("export default"));
  assert.doesNotMatch(nativeBlock, /rgba\(250,204,21/, "Native skeleton must have no yellow gradient.");
  assert.doesNotMatch(nativeBlock, /SunCornerGlow/, "Native skeleton must not render SunCornerGlow.");
});

test("native islands open destinations in the sheet (onClick + dynamic panels)", () => {
  for (const [file, tag, count] of [
    ["components/native/HostNativeHome.tsx", "host-dashboard-native", 6],
    ["components/native/OwnerNativeHome.tsx", "account-dashboard-native", 5],
  ] as const) {
    const src = read(file);
    assert.match(src, new RegExp(`data-testid="${tag}"`), `${file} must render the native dashboard.`);
    assert.match(src, /onClick=\{\(\) => setPanel\(/, `${file} tiles must open a panel, not navigate.`);
    assert.match(src, /<DashboardSheet /, `${file} must render the DashboardSheet.`);
    // Each destination panel is lazy-loaded via an import factory. These live in
    // a PANEL_IMPORTERS map (so we can also prefetch them on idle) and are passed
    // to dynamic(); count the `() => import(...)` factories rather than the inline
    // `dynamic(() => import(` form so the assertion survives that refactor.
    const dynCount = (src.match(/\(\) => import\(/g) ?? []).length;
    assert.ok(dynCount >= count, `${file} must lazy-load its ${count} destination panels (found ${dynCount}).`);
    // Options must be an inline literal (Next requires it for ssr:false).
    assert.match(src, /\{ ssr: false, loading: PanelLoading \}/, `${file} must inline the dynamic options.`);
    // The panel chunks must be prefetched on idle so the first tap opens with a
    // single, uninterrupted spinner (no PanelLoading→page-spinner swap).
    assert.match(src, /requestIdleCallback/, `${file} must prefetch its panel chunks on idle.`);
  }
});
