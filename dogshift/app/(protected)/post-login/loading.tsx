"use client";

import PageLoader from "@/components/ui/PageLoader";

// One consistent loader everywhere in-app: the running dog. (Previously a
// separate purple "branded" paw cover on native — the founder wants the SAME
// running-dog animation on every in-app load; only the cold-launch splash
// stays as the distinct app intro.)
export default function Loading() {
  return <PageLoader />;
}
