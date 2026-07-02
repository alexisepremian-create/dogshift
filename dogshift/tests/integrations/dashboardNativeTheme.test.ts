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
    const dynCount = (src.match(/dynamic\(\(\) => import\(/g) ?? []).length;
    assert.ok(dynCount >= count, `${file} must lazy-load its ${count} destination panels (found ${dynCount}).`);
    // Options must be an inline literal (Next requires it for ssr:false).
    assert.match(src, /\{ ssr: false, loading: PanelLoading \}/, `${file} must inline the dynamic options.`);
  }
});
