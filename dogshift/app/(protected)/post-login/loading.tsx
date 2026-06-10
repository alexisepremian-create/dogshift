"use client";

import PageLoader from "@/components/ui/PageLoader";
import NativeBrandedLoader from "@/components/native/NativeBrandedLoader";
import { useIsNativeApp } from "@/lib/native/useIsNativeApp";

export default function Loading() {
  const isNative = useIsNativeApp();
  // Native: branded purple cover (matches the launch splash) so there's no
  // white-skeleton flash before the post-login redirect resolves.
  if (isNative) return <NativeBrandedLoader />;
  return <PageLoader static />;
}
