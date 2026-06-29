"use client";

import { useState } from "react";

import PageLoader from "@/components/ui/PageLoader";
import HostDashboardSkeletonOverlay from "@/components/native/HostDashboardSkeletonOverlay";

/**
 * Route-level Suspense fallback for the SITTER dashboard root (/host).
 *
 * Native: render the SAME faithful host skeleton (HostDashboardSkeletonOverlay)
 * the route-group fallback, the gates and the /host page render — NOT the
 * generic DashboardSectionLoading (title + chips + rows). One shared overlay
 * across every boundary = one continuous skeleton, never a second shape.
 *
 * Web: keep PageLoader (the running-dog loader is the consistent web feel and
 * loading.tsx must not be empty on web — footer-flash masking).
 */
export default function Loading() {
  const [isNative] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-native") === "true",
  );

  if (isNative) return <HostDashboardSkeletonOverlay />;
  return <PageLoader static />;
}
