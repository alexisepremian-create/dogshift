"use client";

import { useState } from "react";

import PageLoader from "@/components/ui/PageLoader";
import DashboardSkeleton from "@/components/ui/DashboardSkeleton";

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
  const [isNative] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-native") === "true",
  );
  if (isNative) {
    return (
      <div
        className="w-full px-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)" }}
      >
        <DashboardSkeleton />
      </div>
    );
  }
  return <PageLoader static />;
}
