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
export default function NativeRouteFallback({ web }: { web: "loader" | "none" }) {
  const pathname = usePathname();
  const [isNative] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-native") === "true",
  );

  if (isNative) {
    // Each route fallback is a FAITHFUL replica of the destination page's own
    // loading view, so the route→page hand-off shows no visual change — one
    // continuous skeleton (founder: "j'en veux qu'un pour chaque page, smooth").
    if (pathname === "/") return <MapHomeSkeleton />;
    if (pathname.startsWith("/host/requests") || pathname.startsWith("/account/bookings")) {
      return <RequestsRouteSkeleton />;
    }
    if (pathname.startsWith("/host/messages") || pathname.startsWith("/account/messages")) {
      return <MessagesRouteSkeleton />;
    }

    // Other dashboards → generic list skeleton (grey, matching card rows).
    // `min-h-screen bg-white` matches the dashboard shell so the hand-off
    // doesn't flash the slate body; bottom padding clears the z-50 nav.
    return (
      <div
        className="min-h-screen w-full bg-white px-3"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)",
          paddingBottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 24px)",
        }}
      >
        <DashboardSkeleton />
      </div>
    );
  }

  return web === "loader" ? <PageLoader static /> : null;
}
