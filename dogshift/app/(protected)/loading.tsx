import PageLoader from "@/components/ui/PageLoader";

export default function Loading() {
  // Use static mode for Suspense fallbacks so we don't restart the stagger animation
  // if the layout is already mounted.
  return <PageLoader static minDuration={400} persist />;
}
