"use client";

import PageLoader from "@/components/ui/PageLoader";
import { useIsNativeApp } from "@/lib/native/useIsNativeApp";

/**
 * Suspense fallback for the dashboard *home* sections (/host, /account).
 *
 * Native: render nothing — bottom-tab switches must feel instant (Uber/Airbnb
 * style), no full-screen running-dog loader. The section paints as soon as
 * it's ready and the bottom-nav pill slides.
 *
 * Web: keep the PageLoader (the running dog is part of the consistent web
 * loading feel; loading.tsx must not be empty on web — footer-flash masking).
 */
export default function DashboardSectionLoading() {
  const isNative = useIsNativeApp();
  if (isNative) return null;
  return <PageLoader static />;
}
