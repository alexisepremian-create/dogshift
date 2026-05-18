import PageLoader from "@/components/ui/PageLoader";

/**
 * Sitter detail loading state. Same rationale as the parent
 * `app/(marketing)/loading.tsx`: returning `null` here caused a brief
 * footer flash between the layout commit and the sitter page's internal
 * <PageLoader static />. By returning <PageLoader static /> from the
 * Suspense fallback the loader is in place from the very first commit
 * and the handoff to the page's internal loader is invisible.
 */
export default function Loading() {
  return <PageLoader static />;
}
