/**
 * Marketing route loading state.
 *
 * WEB: returns `null` (via NativeRouteFallback's web="none" path) — see
 * `docs/bugs/e2e-smoke-body-text-too-short.md` for the full post-mortem.
 * Short version:
 *
 *  - PR #359 set this to `<PageLoader static />` to bullet-proof the footer-flash
 *    fix. That worked visually in prod, but on Vercel preview deployments the
 *    Suspense boundary on the homepage doesn't resolve within 15 s (Neon cold
 *    start + initial sitter query latency), so Playwright always sees just the
 *    loader (~63 chars) and the smoke test asserting >100 chars always fails.
 *  - The footer flash is now handled by the layered defense in
 *    `components/NavigationOverlayController.tsx` (static <NavigationOverlay />
 *    + MutationObserver handoff to PageLoader if any) + the CSS rules in
 *    `app/globals.css`. The Suspense fallback was belt-and-suspenders only.
 *  - Returning `null` on web unblocks CI on every PR.
 *
 * NATIVE: the /account/* owner dashboards are `force-dynamic` and suspend at
 * THIS group boundary on tab switches. `null` exposed the body background
 * (formerly purple) → founder bug "ecran violet quand je switch entre les
 * sections". A padded skeleton paints instead: neutral, instant, never a
 * purple flash. The web path is untouched (still `null`), so smoke behaviour
 * is unchanged. See components/native/NativeRouteFallback.tsx.
 *
 * If the footer flash regresses (3-frame reveal between Link click and the
 * page content), see `docs/bugs/footer-flash-during-navigation.md`.
 */
import NativeRouteFallback from "@/components/native/NativeRouteFallback";

export default function Loading() {
  return <NativeRouteFallback web="none" />;
}
