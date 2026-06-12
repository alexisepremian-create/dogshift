/**
 * Static "navigation in progress" overlay.
 *
 * Server-rendered in the root layout body, so it's part of the initial HTML
 * payload — no React commit cycle stands between a click and the overlay
 * becoming visible. The companion client component
 * `<NavigationOverlayController />` flips `data-navigating="1"` on
 * `document.body` directly from the click capture handler, which causes the
 * CSS rule in globals.css to swap `display: none` → `display: flex`
 * synchronously in the same frame.
 *
 * What's inside: the shared `<RunningDog />` animation (components/ui/RunningDog.tsx).
 * The founder wants every in-app loading surface to show ONLY the brand
 * "dog running" animation — full screen, nothing else showing through. This
 * overlay covers the click → first-paint gap; the animated `<PageLoader />`
 * (rendered by route `loading.tsx` Suspense fallbacks) carries the SAME dog
 * for the longer data-fetch window, so the visual is seamless across the
 * whole transition.
 *
 * Both web and native render the dog (native used to show gray skeletons —
 * removed, per the redesign).
 */

import RunningDog from "@/components/ui/RunningDog";

export default function NavigationOverlay() {
  return (
    <div id="ds-nav-overlay" aria-hidden="true">
      <RunningDog size={184} className="text-[#7c3aed]" />
    </div>
  );
}
