import PageLoader from "@/components/ui/PageLoader";
import DashboardSkeleton from "@/components/ui/DashboardSkeleton";
import { LayoutDashboard, CalendarDays, MessageSquare, SlidersHorizontal, MoreHorizontal } from "lucide-react";

function StaticBottomNav() {
  const tabs = [
    { icon: <LayoutDashboard className="h-5 w-5" /> },
    { icon: <CalendarDays className="h-5 w-5" /> },
    { icon: <MessageSquare className="h-5 w-5" /> },
    { icon: <SlidersHorizontal className="h-5 w-5" /> },
    { icon: <MoreHorizontal className="h-5 w-5" /> },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-3 mb-3 overflow-hidden rounded-[28px] border border-white/30 bg-white/70 shadow-[0_-2px_24px_rgba(2,6,23,0.08),0_8px_32px_-8px_rgba(2,6,23,0.12)] backdrop-blur-xl">
        <div className="flex h-[60px]">
          {tabs.map((t, i) => (
            <div key={i} className="flex flex-1 items-center justify-center text-slate-300">
              {t.icon}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <>
      {/* Desktop: branded logo loader */}
      <div className="hidden lg:block">
        <PageLoader static persist />
      </div>
      {/* Mobile: inline skeleton + persistent bottom nav placeholder */}
      <div className="lg:hidden">
        <DashboardSkeleton />
        <StaticBottomNav />
      </div>
    </>
  );
}
