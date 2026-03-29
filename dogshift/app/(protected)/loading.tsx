import PageLoader from "@/components/ui/PageLoader";

export default function Loading() {
  // Use stagger animation. We set minDuration to 2800 to ensure
  // the full animation plays before the loader unmounts.
  return <PageLoader minDuration={2800} persist />;
}
