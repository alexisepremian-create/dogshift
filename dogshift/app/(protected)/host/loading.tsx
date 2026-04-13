import PageLoader from "@/components/ui/PageLoader";
import DashboardSkeleton from "@/components/ui/DashboardSkeleton";

export default function Loading() {
  return (
    <>
      {/* Desktop: branded logo loader */}
      <div className="hidden lg:block">
        <PageLoader static persist />
      </div>
      {/* Mobile: inline skeleton that doesn't cover the bottom nav */}
      <div className="lg:hidden">
        <DashboardSkeleton />
      </div>
    </>
  );
}
