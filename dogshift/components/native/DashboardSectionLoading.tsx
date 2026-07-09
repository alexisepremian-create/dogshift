"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import PageLoader from "@/components/ui/PageLoader";
import DashboardSkeleton from "@/components/ui/DashboardSkeleton";
import AccountPageSkeleton from "@/components/ui/AccountPageSkeleton";

/**
 * Suspense fallback for the dashboard *home* sections (/host, /account).
 *
 * Native: render a padded skeleton — bottom-tab switches must feel instant
 * (Uber/Airbnb style) with a fluid loading shimmer, NEVER the full-screen
 * running-dog loader and NEVER a blank white page (founder: "je veux une
 * hydration fluide type skeleton de chargement a la place d'une page blanche").
 * `isNative` is read synchronously from `data-native` so the very first client
 * render is correct (no 1-frame flash of the web loader).
 *
 * Web: keep the PageLoader (the running dog is part of the consistent web
 * loading feel; loading.tsx must not be empty on web — footer-flash masking).
 */
export default function DashboardSectionLoading() {
  const pathname = usePathname();
  const [isNative] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-native") === "true",
  );
  if (isNative) {
    // Réservations / Messages (owner) render AccountPageSkeleton in their own
    // loading.tsx + page — so this fallback must render the SAME skeleton, never
    // the generic DashboardSkeleton, or the founder sees two different skeletons.
    const isOwnerListTab =
      pathname === "/account/bookings" ||
      pathname === "/account/messages" ||
      pathname.startsWith("/account/bookings/") ||
      pathname.startsWith("/account/messages/");
    // For owner list tabs, match OwnerDashboardShell's native content box
    // (top = safe-area + banner + 0.75rem) so the skeleton doesn't jump position
    // when the shell + page's own AccountPageSkeleton take over.
    const topPad = isOwnerListTab
      ? "calc(env(safe-area-inset-top, 0px) + var(--ds-maintenance-banner-height, 0px) + 0.75rem)"
      : "calc(env(safe-area-inset-top, 0px) + 2rem)";
    return (
      <div
        className="w-full px-3"
        style={{
          paddingTop: topPad,
          paddingBottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 24px)",
        }}
      >
        {isOwnerListTab ? <AccountPageSkeleton /> : <DashboardSkeleton />}
      </div>
    );
  }
  return <PageLoader static />;
}
