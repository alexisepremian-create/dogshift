"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import PageLoader from "@/components/ui/PageLoader";
import DashboardSkeleton from "@/components/ui/DashboardSkeleton";
import MapHomeSkeleton from "@/components/native/MapHomeSkeleton";
import { RequestsRouteSkeleton, MessagesRouteSkeleton } from "@/components/native/SectionRouteSkeletons";

/**
 * Suspense fallback for the route-GROUP boundaries — `app/(protected)/loading.tsx`
 * and `app/(marketing)/loading.tsx`.
 *
 * Why these matter for native: the `/host/*` and `/account/*` layouts are
 * `force-dynamic` (they `await` a DB read on every navigation). An async layout
 * suspends the *layout itself*, so Next.js falls back to the nearest ancestor
 * boundary — the GROUP-level `loading.tsx`, NOT the section's own skeleton.
 * That meant:
 *   - Sitter tabs (→ /host/*)  showed `(protected)/loading.tsx` = the full-screen
 *     running-dog <PageLoader />.
 *   - Owner tabs (→ /account/*) showed `(marketing)/loading.tsx` = `null`, which
 *     exposed the (then purple) body background.
 * Founder bug: "quand je switch entre les sections ya des fois ecran violet ou
 * chien animé, je veux juste que ça slide normal et fluidement comme une app pro".
 *
 * Native: render a lightweight, status-bar-padded skeleton — instant, neutral,
 * never the running dog and never a purple/blank gap. Web: keep the existing
 * behaviour (running dog for protected, `null` for marketing so the e2e smoke
 * test is unaffected).
 *
 * `isNative` is read synchronously from the `data-native` attribute (set by the
 * inline boot script in app/layout.tsx) so the first client render is already
 * correct — no 1-frame flash of the web loader before switching.
 */
export default function NativeRouteFallback({ web }: { web: "loader" | "none" | "spacer" }) {
  const pathname = usePathname();
  const [isNative] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-native") === "true",
  );

  if (isNative) {
    // HOME → a map+sheet skeleton that matches NativeMapHome (both are
    // `fixed inset-0`), so the hand-off is seamless.
    if (pathname === "/") return <MapHomeSkeleton />;

    // Réservations / Conversations: the layout's force-dynamic DB read is SLOW,
    // so this fallback is on screen for a real moment — it MUST show a skeleton
    // (returning null painted a white screen = the regression). These replicas
    // reproduce the page's exact in-shell position + low card counts, so the
    // route→page hand-off shows the same skeleton and nothing spills under nav.
    if (pathname.startsWith("/host/requests") || pathname.startsWith("/account/bookings")) {
      return <RequestsRouteSkeleton />;
    }
    if (pathname.startsWith("/host/messages") || pathname.startsWith("/account/messages")) {
      return <MessagesRouteSkeleton />;
    }

    // Other dashboards (host/account home) have no own skeleton → a generic
    // list skeleton. Fixed overlay (z-40, below the nav) covers the transition
    // gap instantly so no white body flashes; bottom padding clears the nav.
    return (
      <div
        className="fixed inset-0 z-40 w-full overflow-y-auto bg-white px-3"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)",
          paddingBottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 24px)",
        }}
      >
        <DashboardSkeleton />
      </div>
    );
  }

  if (web === "loader") return <PageLoader static />;
  // "spacer": reserve a full viewport height while the page's streaming SSR
  // (e.g. the homepage's async getFeaturedSitters DB read) is pending, so the
  // footer/header don't collapse to the top of the screen — the recurring
  // "I see the footer first" flash. Deliberately a plain empty div with NO
  // PageLoader and NO text: a loader marker would hide header+footer via the
  // footer-flash CSS and re-break the e2e smoke (>100 char body assertion) on
  // cold-Neon previews. See docs/bugs/homepage-footer-flash-initial-load.md.
  if (web === "spacer") return <div aria-hidden className="min-h-screen bg-white" />;
  return null;
}
