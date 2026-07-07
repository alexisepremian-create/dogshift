/**
 * Checkout route loading fallback.
 *
 * Overrides the marketing group's `NativeRouteFallback` skeleton for this route
 * so the transition into /checkout and the page's own data-fetch state show the
 * SAME single spinner (no skeleton→logo double flash the founder reported). Kept
 * identical to the page's `loading` branch below.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
    </div>
  );
}
