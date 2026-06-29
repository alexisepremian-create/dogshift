"use client";

import HostDashboardSkeleton from "@/components/HostDashboardSkeleton";

/**
 * Fixed full-screen native overlay that renders the faithful host-dashboard
 * skeleton, padded so it lands EXACTLY where the in-shell page skeleton sits
 * (HostDashboardShell's native <main>: px-3 + pt safe-area+banner+2rem, inner
 * py-3 → top = safe-area+banner+2rem+0.75rem, left = 0.75rem).
 *
 * Used by EVERY Suspense/gate boundary on the /host root — the route-group
 * fallback (NativeRouteFallback), the route fallback (host/loading.tsx) and the
 * gates (NativeDashboardLoading) — so the skeleton never changes shape OR shifts
 * position across the hand-offs. The /host page itself renders the bare
 * HostDashboardSkeleton inside the shell, which lands in the same place. Result:
 * a single continuous skeleton from navigation to content, never a second one.
 *
 * z-40 keeps it BELOW the bottom nav (which stays visible during plain tab
 * switches); during an auth transition the nav is hidden by CSS anyway.
 */
export default function HostDashboardSkeletonOverlay() {
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
