"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import WebSectionSkeleton from "@/components/skeletons/WebSectionSkeleton";
import DashboardSkeleton from "@/components/ui/DashboardSkeleton";
import OwnerListRouteSkeleton from "@/components/native/OwnerListRouteSkeleton";

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
    // Réservations / Messages (owner) render the SAME unified overlay skeleton as
    // their own loading.tsx + the route-group boundary, so the whole load is one
    // unmoving skeleton — never two different ones.
    const isOwnerListTab =
      pathname === "/account/bookings" ||
      pathname === "/account/messages" ||
      pathname.startsWith("/account/bookings/") ||
      pathname.startsWith("/account/messages/");
    if (isOwnerListTab) return <OwnerListRouteSkeleton />;
    return (
      <div
        className="w-full px-3"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)",
          paddingBottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 24px)",
        }}
      >
        <DashboardSkeleton />
      </div>
    );
  }
  // Web: in-flow skeleton inside the shell → the left sidebar stays visible.
  return <WebSectionSkeleton />;
}
