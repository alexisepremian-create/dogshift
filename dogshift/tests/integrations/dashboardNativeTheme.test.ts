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
