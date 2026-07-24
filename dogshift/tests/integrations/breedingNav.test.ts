import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * The center bottom-nav FAB now opens the breeding "Rencontres" feature, and the
 * old "more menu" (Mon compte, legal, Déconnexion…) moved to the homepage
 * search-bar button. Lock that wiring so it can't silently regress (losing the
 * menu would strand logout/legal on native).
 */
test("center FAB opens /breeding and no longer renders the more-menu sheet", () => {
  const bar = read("components/native/NativeTabBar.tsx");
  assert.match(bar, /router\.push\("\/breeding"\)/, "center FAB must navigate to /breeding.");
  assert.doesNotMatch(bar, /moreItems/, "NativeTabBar must not render the more menu anymore.");
  assert.doesNotMatch(bar, /setMoreOpen/, "NativeTabBar must drop the more-sheet state.");
});

test("the more menu is re-homed on the homepage search bar via the shared hook", () => {
  const map = read("components/native/NativeMapHome.tsx");
  assert.match(map, /useNativeMenuItems/, "NativeMapHome must build the menu from the shared hook.");
  assert.match(map, /setMenuOpen\(true\)/, "NativeMapHome must have a menu button.");

  const nav = read("components/native/GlobalNativeBottomNav.tsx");
  assert.doesNotMatch(nav, /moreItems=\{/, "GlobalNativeBottomNav must stop passing moreItems.");
});

test("breeding page is native-gated", () => {
  const page = read("app/(marketing)/breeding/page.tsx");
  assert.match(page, /useIsNativeAppSync/, "breeding page must gate on native.");
  assert.match(page, /<BreedingHome/, "breeding page must render BreedingHome when native + authed.");
});
