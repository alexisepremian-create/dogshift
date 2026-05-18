/**
 * Marketing route loading state.
 *
 * Returns `null` intentionally — see `docs/bugs/e2e-smoke-body-text-too-short.md`
 * for the full post-mortem. Short version:
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
 *  - Returning `null` here unblocks CI on every PR.
 *
 * If the footer flash regresses (3-frame reveal between Link click and the
 * page content), see `docs/bugs/footer-flash-during-navigation.md` — the
 * playbook there covers the layered fix without bringing the PageLoader back
 * to the Suspense fallback.
 */
export default function Loading() {
  return null;
}
