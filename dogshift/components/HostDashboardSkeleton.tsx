"use client";

import SunCornerGlow from "@/components/SunCornerGlow";
import { useIsNativeAppSync } from "@/lib/native/useIsNativeAppSync";

/**
 * Faithful loading skeleton for the SITTER dashboard (/host root) — a pixel
 * replica of the real dashboard layout (header card → identity row → 2×2 KPI
 * grid → two content sections). Shared so the gate (HostDataGate /
 * HostHydrationGate via NativeDashboardLoading) and the /host PAGE itself render
 * the EXACT same shape. Before extraction the gate showed the generic
 * components/ui/DashboardSkeleton (title + chips + rows) and the page showed
 * this one, so the user saw TWO different skeletons flash in sequence. One
 * shared component = one continuous skeleton.
 */
function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-pulse rounded-md bg-slate-200/80 ${className ?? ""}`}
    />
  );
}

/**
 * Native skeleton — mirrors the minimalist native home (greeting → progress →
 * 3 stats → "Accès rapide" → 2×2 tiles → 2 ghost tiles). No warm gradient / no
 * SunCornerGlow, so it matches the white native dashboard behind it exactly
 * (founder: "faut que ça reflète exactement ce qui charge derrière", + no flash).
 */
function HostNativeSkeleton() {
  return (
    <div className="space-y-4" data-testid="host-dashboard-skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement du tableau de bord…</span>

      {/* Greeting */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-6 w-40" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Complete-profile bar */}
      <Skeleton className="h-14 w-full rounded-2xl" />

      {/* 3 stat chips */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-slate-50 p-3">
            <Skeleton className="mx-auto block h-5 w-10" />
            <Skeleton className="mx-auto mt-2 block h-3 w-12" />
          </div>
        ))}
      </div>

      <Skeleton className="h-4 w-28" />

      {/* 2×2 tiles + 2 ghost tiles */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] w-full rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function HostDashboardSkeleton() {
  const isNative = useIsNativeAppSync();
  if (isNative) return <HostNativeSkeleton />;

  return (
    <div
      className="relative grid gap-6 overflow-hidden"
      data-testid="host-dashboard-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="hidden sm:block">
        <SunCornerGlow variant="sitterDashboard" />
      </div>
      <div
        className="pointer-events-none fixed inset-0 z-0 sm:hidden"
        aria-hidden="true"
        style={{
          background: "linear-gradient(135deg, rgba(250,204,21,0.22) 0%, rgba(251,146,60,0.10) 28%, transparent 58%)",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) 160px, rgba(0,0,0,0) 300px)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) 160px, rgba(0,0,0,0) 300px)",
        }}
      />
      <span className="sr-only">Chargement du tableau de bord…</span>

      <div className="relative z-10">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Skeleton className="h-4 w-32" />
            <div className="mt-2 flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex w-full items-center gap-3">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-7 w-7 rounded-full" />
                <div className="ml-3 hidden w-full max-w-[420px] md:block">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Skeleton className="h-4 w-56 max-w-full" />
                        <Skeleton className="mt-2 h-3 w-72 max-w-full" />
                        <Skeleton className="mt-2 h-3 w-36 max-w-full" />
                      </div>
                      <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex min-h-[32px] flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-3 h-7 w-16" />
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-3 w-64 max-w-full" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="mt-2 h-2 w-full rounded-full" />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <Skeleton className="h-4 w-28" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
