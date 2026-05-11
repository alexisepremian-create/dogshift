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

// Pages where masking is unnecessary (instant marketing landings, the
// post-login redirector which is itself a loader, etc.).
const SKIP_PATHS = [
  "/",
  "/login",
  "/signup",
  "/sign-out",
  "/post-login",
  "/check-email",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

function isSkippedHref(href: string): boolean {
  const path = href.split("?")[0]?.split("#")[0] ?? "";
  return SKIP_PATHS.some((p) => path === p);
}

function clearOverlay() {
  if (typeof document === "undefined") return;
  document.body.removeAttribute("data-navigating");
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
  return !SKIP_PATHS.some((p) => pathOnly === p);
}

export default function NavigationOverlayController() {
  const pathname = usePathname();

  // Whenever the pathname actually changes, the new page (or its loading.tsx
  // Suspense fallback) is in the DOM. We give the browser one frame to paint
  // it, then hide the static overlay.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(clearOverlay);
    });
    return () => cancelAnimationFrame(id);
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

      // SYNCHRONOUSLY flip the body attribute → CSS shows the overlay.
      document.body.dataset.navigating = "1";
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
      if (shouldShowOverlayFor(url, pathname)) {
        document.body.dataset.navigating = "1";
      }
      return origPush.call(window.history, data, unused, url);
    };
    const wrappedReplace: typeof window.history.replaceState = function (data, unused, url) {
      if (shouldShowOverlayFor(url, pathname)) {
        document.body.dataset.navigating = "1";
      }
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
