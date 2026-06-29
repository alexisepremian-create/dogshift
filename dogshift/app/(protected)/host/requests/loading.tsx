import NativeRouteFallback from "@/components/native/NativeRouteFallback";

/**
 * /host/requests is the most-specific loading boundary, so it wins over the
 * group fallback. It MUST render the same pathname-aware skeleton as the group
 * fallback — otherwise the tab shows a generic placeholder that doesn't match
 * the real Réservations layout (founder: "le skeleton doit être formé de la même
 * manière que ce qui va apparaître"). NativeRouteFallback → RequestsRouteSkeleton
 * on native, running-dog PageLoader on web.
 */
export default function Loading() {
  return <NativeRouteFallback web="loader" />;
}
