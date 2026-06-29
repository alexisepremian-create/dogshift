"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import DashboardSkeleton from "@/components/ui/DashboardSkeleton";
import HostDashboardSkeleton from "@/components/HostDashboardSkeleton";
import { RequestsRouteSkeleton, MessagesRouteSkeleton } from "@/components/native/SectionRouteSkeletons";

/**
 * Native loading skeleton for the host/account dashboard GATES
 * (HostHydrationGate / HostDataGate). Those gates wrap the dashboard shell and
 * render `null` (= a WHITE screen) during their hydration + data-ready wait
 * windows (HostDataGate even debounces ~150ms before showing content). That
 * white window appears AFTER the route-group Suspense fallback unmounts and
 * BEFORE the shell paints — it was the real "mini flash page blanche" the
 * founder kept seeing on the dashboards.
 *
 * Rendering this instead of `null` keeps a continuous skeleton across the whole
 * chain: route fallback → gate hydration wait → gate data wait → page. It's the
 * SAME pathname-aware skeleton the route fallback uses, so nothing visually
 * changes through the hand-offs.
 *
 * Web: returns `null` (the gates' prior behaviour) so nothing changes off-app.
 * `isNative` is read synchronously from `data-native` so the first render is
 * already correct.
 */
export default function NativeDashboardLoading() {
  const pathname = usePathname();
  const [isNative] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-native") === "true",
  );

  if (!isNative) return null;

  if (pathname.startsWith("/host/requests") || pathname.startsWith("/account/bookings")) {
    return <RequestsRouteSkeleton />;
  }
  if (pathname.startsWith("/host/messages") || pathname.startsWith("/account/messages")) {
    return <MessagesRouteSkeleton />;
  }

  // Sitter dashboard root: render the SAME faithful host skeleton the /host page
  // shows (HostDashboardSkeleton), so the gate → page hand-off is one continuous
  // shape — not the generic DashboardSkeleton (title+chips+rows) flashing before
  // the page's own layout-faithful one. Padding mirrors HostDashboardShell's
  // native <main> (px-3, pt safe-area+banner+2rem, inner py-3) so there's no
  // position shift across the hand-off.
  if (pathname === "/host") {
    return (
      <div
        className="fixed inset-0 z-40 w-full overflow-y-auto bg-white px-3"
        style={{
          paddingTop:
            "calc(env(safe-area-inset-top, 0px) + var(--ds-maintenance-banner-height, 0px) + 2rem + 0.75rem)",
          paddingBottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 24px)",
        }}
      >
        <HostDashboardSkeleton />
      </div>
    );
  }

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
