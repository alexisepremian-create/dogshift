"use client";

/**
 * Synchronously shows the navigation overlay (rendered statically by
 * <NavigationOverlay /> in the root layout) the moment an internal link is
 * clicked. Hides it once the new pathname is mounted.
 *
 * The reason for setting `document.body.dataset.navigating` directly (instead
 * of going through React state) is that React's render → commit cycle
 * happens AFTER the browser has already started laying out the old tree
 * for the next paint. By flipping a body attribute in the click capture
 * handler we let CSS take over before React even schedules a re-render —
 * no 1-frame gap where the footer briefly shows through.
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
      obs.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [pathname]);

  return null;
}
