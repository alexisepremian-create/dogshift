import PageLoader from "@/components/ui/PageLoader";
import DashboardSkeleton from "@/components/ui/DashboardSkeleton";

export default function Loading() {
  return (
    <>
      <div className="hidden lg:block">
        <PageLoader label="Chargement…" static />
      </div>
      <div className="lg:hidden">
        <DashboardSkeleton />
      </div>
    </>
  );
}
