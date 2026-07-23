"use client";

import { useState } from "react";

import WebSectionSkeleton from "@/components/skeletons/WebSectionSkeleton";
import HostDashboardSkeletonOverlay from "@/components/native/HostDashboardSkeletonOverlay";

/**
 * Route-level Suspense fallback for the SITTER dashboard root (/host).
 *
 * Native: the faithful host skeleton overlay (HostDashboardSkeletonOverlay).
 * Web: an IN-FLOW skeleton (WebSectionSkeleton) rendered inside the shell's
 * <main> so the left sidebar stays visible — no more full-screen running dog.
 */
export default function Loading() {
  const [isNative] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-native") === "true",
  );

  if (isNative) return <HostDashboardSkeletonOverlay />;
  return <WebSectionSkeleton />;
}
