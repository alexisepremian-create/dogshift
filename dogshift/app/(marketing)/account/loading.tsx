import PageLoader from "@/components/ui/PageLoader";

// Fullscreen overlay during account-route transitions — keeps footer hidden.
export default function Loading() {
  return <PageLoader static />;
}
