import NativeRouteFallback from "@/components/native/NativeRouteFallback";

/**
 * Route-group fallback for /host/*, /account/* (protected). The dashboard
 * layouts are `force-dynamic`, so they suspend HERE on every tab switch.
 *
 * Native: a padded skeleton (instant, no full-screen running dog).
 * Web: the running-dog <PageLoader /> (unchanged web feel).
 * See components/native/NativeRouteFallback.tsx for the full rationale.
 */
export default function Loading() {
  return <NativeRouteFallback web="loader" />;
}
