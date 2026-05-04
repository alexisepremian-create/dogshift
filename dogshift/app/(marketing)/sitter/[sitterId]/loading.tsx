import PageLoader from "@/components/ui/PageLoader";

// Fullscreen overlay while the sitter profile page loads — keeps footer hidden.
export default function Loading() {
  return <PageLoader static />;
}
