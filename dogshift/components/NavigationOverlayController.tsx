"use client";

/**
 * Synchronously shows the navigation overlay (rendered statically by
 * <NavigationOverlay /> in the root layout) the moment a navigation starts.
 * Hides it once the new pathname is mounted.
 *
 * Two trigger paths:
 *
 *   1. Click capture on <a href="/...">  — catches every Link click before
 *      React's bubble-phase handler runs.
 *
 *   2. Monkey-patched window.history.pushState / replaceState — catches
 *      programmatic navigations (`router.push(...)`, `router.replace(...)`)
 *      that don't originate from an anchor tag (e.g. card onClick handlers,
 *      form submissions, auth redirects, search filter applies).
 *
 * Both flip `document.body.dataset.navigating = "1"` synchronously, so the
 * CSS rule in globals.css (`body[data-navigating="1"] #ds-nav-overlay
 * { display: flex }`) takes effect in the same frame the browser is about
 * to paint — no 1-frame gap where the footer flashes through.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Pages where masking is unnecessary: the auth flow is essentially a sequence
// of micro-pages (login → check-email → reset-password → login) where each
// transition is near-instant and showing a brief overlay on each step would
// feel jittery rather than smooth. Heavy / data-fetching pages (homepage,
// /sitter/*, /account/*, /host/*, /search, etc.) are intentionally NOT in
// this list so they get the overlay until their content is painted.
const SKIP_PATHS = [
  "/login",
  "/signup",
  "/sign-out",
  "/post-login",
  "/check-email",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

/**
 * The admin panel is a dense, internal SPA where every section switch
 * (Dashboard, Utilisateurs, Voir comme…, Agents, …) must feel instant — a
 * full-screen running-dog loader on every click is jarring for the operator.
 * Each admin page ships its own lightweight skeleton (`admin/loading.tsx`,
 * which keeps the sidebar visible), so the overlay is pure noise here. Suppress
 * it for the whole `/admin` subtree.
 */
export function isAdminRoute(pathOnly: string): boolean {
  return pathOnly === "/admin" || pathOnly.startsWith("/admin/");
}

function isSkippedHref(href: string): boolean {
  const path = href.split("?")[0]?.split("#")[0] ?? "";
  return isAdminRoute(path) || SKIP_PATHS.some((p) => path === p);
}

/**
 * In the NATIVE app, switching between the bottom-tab sections must feel
 * instant — like Uber/Airbnb — with the bottom-nav pill sliding, NOT a
 * full-screen running-dog loader. So we suppress the overlay for the tab
 * destinations (home + the owner/sitter dashboards). On the web these keep
 * the overlay (the dog is part of the consistent web feel). Gated on the
 * `data-native` attribute set synchronously by the inline boot script.
 */
function isNativeInstantRoute(pathOnly: string): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.getAttribute("data-native") !== "true") return false;
  // Tab destinations + every route reachable from the bottom-nav "Plus" sheet,
  // so tapping ANY nav cell feels instant (no full-screen loader). The
  // running-dog loader stays for content navigations (e.g. /sitter/* profiles,
  // /search) which actually fetch data.
  return (
    pathOnly === "/" ||
    pathOnly === "/host" ||
    pathOnly.startsWith("/host/") ||
    pathOnly === "/account" ||
    pathOnly.startsWith("/account/") ||
    pathOnly === "/devenir-dogsitter" ||
    pathOnly === "/contact" ||
    pathOnly === "/cgu" ||
    pathOnly === "/confidentialite" ||
    pathOnly === "/mentions-legales"
  );
}

/**
 * Minimum duration the navigation overlay stays visible. Even if content
 * commits faster (e.g. a 50 ms route change), the overlay holds for at
 * least this long so:
 *   - The animated logo (brandPulse, 1.8 s loop) has time to feel
 *     intentional rather than flicker-and-gone
 *   - Layout-chrome elements (header buttons, footer) don't visibly
 *     re-render under it during the in-between paints
 *
 * 600 ms is the sweet spot: imperceptible delay on fast nav, full
 * coverage of the messy "layout shell visible but new children not
 * yet committed" window on slow pages.
 */
const MIN_OVERLAY_MS = 600;

/**
 * Footer-hide cooldown. Set on click, cleared after a fixed window so
 * the footer stays hidden even after the overlay has cleared. Matched
 * to MIN_OVERLAY_MS so the two windows align.
 */
const FOOTER_HIDE_MS = MIN_OVERLAY_MS;

/** Tracks when the current navigation started, used to enforce MIN_OVERLAY_MS. */
let navigationStartedAt = 0;

function clearOverlayNow() {
  if (typeof document === "undefined") return;
  document.body.removeAttribute("data-navigating");
}

/**
 * Clear the overlay, but never sooner than MIN_OVERLAY_MS after the
 * navigation started. If we're past that already, clear immediately;
 * otherwise schedule the clear for the remaining window.
 */
function clearOverlay() {
  if (typeof window === "undefined") return;
  const elapsed = Date.now() - navigationStartedAt;
  const remaining = MIN_OVERLAY_MS - elapsed;
  if (remaining <= 0) {
    clearOverlayNow();
  } else {
    window.setTimeout(clearOverlayNow, remaining);
  }
}

function setNavigating() {
  if (typeof document === "undefined") return;
  navigationStartedAt = Date.now();
  document.body.dataset.navigating = "1";
  document.body.dataset.navCooldown = "1";
  window.setTimeout(() => {
    if (typeof document !== "undefined") {
      document.body.removeAttribute("data-nav-cooldown");
    }
  }, FOOTER_HIDE_MS);
}

/**
 * Inspect a "next URL" passed to history.pushState / replaceState and decide
 * whether we should flash the overlay. We mirror the click-handler skip list
 * here so e.g. a router.replace("/login?force=1") right after sign-out
 * doesn't trigger an overlay that would feel pointless.
 */
function shouldShowOverlayFor(nextUrl: unknown, currentPathname: string | null): boolean {
  let pathOnly = "";
  try {
    if (typeof nextUrl !== "string") return false;
    // Both absolute (https://…) and relative (/foo?…) inputs are valid.
    const u = nextUrl.startsWith("/")
      ? new URL(nextUrl, "https://placeholder.local")
      : new URL(nextUrl);
    pathOnly = u.pathname;
  } catch {
    return false;
  }
  if (!pathOnly.startsWith("/")) return false;
  if (pathOnly === currentPathname) return false;
  if (isNativeInstantRoute(pathOnly)) return false;
  if (isAdminRoute(pathOnly)) return false;
  return !SKIP_PATHS.some((p) => pathOnly === p);
}

export default function NavigationOverlayController() {
  const pathname = usePathname();

  // After the pathname changes, we need to hand off the static overlay to
  // either:
  //   a) the new page's `loading.tsx` <PageLoader /> (it carries
  //      data-page-loader="1") — handoff is instant, no visual gap.
  //   b) the new page's actual content if it rendered fast enough that no
  //      loader was needed.
  //
  // The previous implementation cleared after 2 RAFs (~32 ms) which was
  // before the Suspense fallback had a chance to commit, producing a
  // 1-frame footer flash. We now wait for an actual signal:
  //   - MutationObserver fires the moment PageLoader is added → clear.
  //   - Otherwise, after 6 RAFs (~100 ms — enough for fast pages to paint
  //     real content), clear as a soft failsafe.
  //   - 2 s hard upper bound to avoid getting permanently stuck.
  useEffect(() => {
    if (typeof document === "undefined") return;

    // If the loader is already there (fast HMR / same-route mount), clear
    // immediately.
    if (document.querySelector('[data-page-loader="1"]')) {
      clearOverlay();
      return;
    }

    let cleared = false;
    let rafCount = 0;
    let rafId = 0;
    let hardTimeout = 0;

    function finish() {
      if (cleared) return;
      cleared = true;
      observer.disconnect();
      cancelAnimationFrame(rafId);
      window.clearTimeout(hardTimeout);
      clearOverlay();
    }

    // (a) PageLoader appeared → hand off.
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-page-loader="1"]')) finish();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // (b) Soft failsafe — page rendered without needing a PageLoader.
    function tick() {
      if (cleared) return;
      if (++rafCount >= 6) {
        finish();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    // (c) Hard upper bound — never leave the overlay stuck.
    hardTimeout = window.setTimeout(finish, 2000);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
      window.clearTimeout(hardTimeout);
    };
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Modifier keys → "open in new tab" etc. — don't show overlay.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      const target = e.target as Element | null;
      if (!target) return;

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href") ?? "";
      // Only same-origin internal navigations.
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      if (href.startsWith("/api/")) return;
      // Hash-only / query-only links on the same path don't re-render the page.
      const currentPath = pathname ?? "/";
      const targetPath = href.split("?")[0]?.split("#")[0] ?? "";
      if (targetPath === currentPath) return;
      if (isSkippedHref(href)) return;
      // Native tab switches are instant (no loader) — see isNativeInstantRoute.
      if (isNativeInstantRoute(targetPath)) return;

      // SYNCHRONOUSLY flip the body attributes → CSS shows the overlay AND
      // hides the footer for FOOTER_HIDE_MS (covers the gap between overlay
      // clear and new page children commit on pages without a PageLoader).
      setNavigating();
    }

    // Capture phase so we run before the link's default action / React's
    // synthetic event handlers attached in bubble phase.
    document.addEventListener("click", onClick, { capture: true });

    // ── Programmatic navigation interception ──────────────────────────────
    // Next.js's `router.push()` / `router.replace()` go through
    // window.history.pushState / replaceState. We wrap those so card
    // onClick handlers, search filters, etc. also trigger the overlay.
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    const wrappedPush: typeof window.history.pushState = function (data, unused, url) {
      if (shouldShowOverlayFor(url, pathname)) setNavigating();
      return origPush.call(window.history, data, unused, url);
    };
    const wrappedReplace: typeof window.history.replaceState = function (data, unused, url) {
      if (shouldShowOverlayFor(url, pathname)) setNavigating();
      return origReplace.call(window.history, data, unused, url);
    };
    window.history.pushState = wrappedPush;
    window.history.replaceState = wrappedReplace;

    // Defensive: if the user hits Back/Forward, hide the overlay too.
    window.addEventListener("popstate", clearOverlay);
    // If the overlay somehow gets stuck (e.g. failed navigation), failsafe.
    let failsafe = window.setTimeout(() => undefined, 0);
    const onAttrCheck = () => {
      window.clearTimeout(failsafe);
      if (document.body.dataset.navigating === "1") {
        failsafe = window.setTimeout(clearOverlay, 4000);
      }
    };
    const obs = new MutationObserver(onAttrCheck);
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-navigating"] });

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", clearOverlay);
      // Restore originals — only if we're still the active wrapper (HMR-safe).
      if (window.history.pushState === wrappedPush) {
        window.history.pushState = origPush;
      }
      if (window.history.replaceState === wrappedReplace) {
        window.history.replaceState = origReplace;
      }
      obs.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [pathname]);

  return null;
}
