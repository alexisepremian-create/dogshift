import NativeRouteFallback from "@/components/native/NativeRouteFallback";

/**
 * Most-specific loading boundary for /host/messages — must render the faithful
 * Conversations skeleton (NativeRouteFallback → MessagesRouteSkeleton on native),
 * not a generic placeholder, so the tab load matches what appears. Web keeps the
 * running-dog PageLoader.
 */
export default function Loading() {
  return <NativeRouteFallback web="loader" />;
}
