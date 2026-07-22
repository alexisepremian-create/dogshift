"use client";

import { useState } from "react";

import AccountPageSkeleton from "@/components/ui/AccountPageSkeleton";
import { useInDashboardSheet } from "@/components/native/dashboardSheetContext";

/**
 * The SINGLE, canonical loading placeholder for the owner list tabs
 * (Réservations, Messages).
 *
 * Native ROUTE (bottom-nav tab): these routes suspend at TWO boundaries in
 * sequence — the force-dynamic /account layout at the route-GROUP boundary
 * ((marketing)/loading.tsx), then the page at its SEGMENT boundary
 * (bookings|messages/loading.tsx). If those render the skeleton differently (a
 * full-screen overlay vs. an in-flow box) the user sees the skeleton jump —
 * "deux skeletons différents". Rendering the exact same fixed overlay at BOTH
 * boundaries (and the page's own loading state) makes the whole load one
 * continuous, unmoving skeleton.
 *
 * Dashboard SHEET (tile popup) or WEB: no fixed overlay — just AccountPageSkeleton,
 * which already collapses to a spinner inside a sheet and stays a skeleton on web.
 */
export default function OwnerListRouteSkeleton() {
  const inSheet = useInDashboardSheet();
  const [isNative] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-native") === "true",
  );

  // Only the native ROUTE uses the fixed overlay. In a sheet the AccountPageSkeleton
  // becomes a centered spinner; on web it stays an in-flow skeleton.
  if (inSheet || !isNative) return <AccountPageSkeleton />;

  return (
    <div
      className="fixed inset-0 z-40 w-full overflow-y-auto bg-white px-3"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + var(--ds-maintenance-banner-height, 0px) + 0.75rem)",
        paddingBottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 24px)",
      }}
    >
      <AccountPageSkeleton />
    </div>
  );
}
