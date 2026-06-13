"use client";

/**
 * Loading skeleton for the native HOME map screen (`/`).
 *
 * Mirrors NativeMapHome's real layout — a full-bleed map area, the floating
 * search bar + service chips at the top, and the collapsed bottom sheet with a
 * single sitter-preview card. Founder: "sur la home, mets juste la carte et le
 * preview sitter dans le skeleton, pas un grand skeleton en liste — sinon c'est
 * pas cohérent."
 *
 * Rendered `fixed inset-0 z-0` (BELOW the z-50 bottom nav) so the nav stays
 * visible and the hand-off to the real NativeMapHome (also fixed inset-0) is
 * seamless.
 */
export default function MapHomeSkeleton() {
  return (
    <div className="fixed inset-0 z-0 bg-slate-100">
      {/* Search bar + service chips (top) */}
      <div
        className="absolute left-2 right-2 space-y-2"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 4px)" }}
      >
        <div className="ds-skel h-12 w-full rounded-full" />
        <div className="flex gap-2">
          <div className="ds-skel h-9 w-28 rounded-full" />
          <div className="ds-skel h-9 w-24 rounded-full" />
          <div className="ds-skel h-9 w-24 rounded-full" />
        </div>
      </div>

      {/* Collapsed bottom sheet with one sitter-preview card */}
      <div
        className="absolute left-2 right-2 rounded-3xl bg-white p-4 shadow-[0_-8px_24px_rgba(2,6,23,0.14)]"
        style={{
          bottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 16px)",
          height: "148px",
        }}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="ds-skel h-5 w-32 rounded-lg" />
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-100 p-2">
          <div className="ds-skel h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="ds-skel h-3.5 w-3/4 rounded" />
            <div className="ds-skel h-3 w-1/2 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
