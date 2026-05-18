import PageLoader from "@/components/ui/PageLoader";

/**
 * Marketing route loading state.
 *
 * Renders <PageLoader static /> as the Suspense fallback while the page
 * tree is being rendered. Without this (when we returned `null`), client-
 * side navigations briefly revealed the marketing layout chrome (header +
 * empty content + footer) before any per-page content committed — which
 * the user perceived as a "footer flash" before the loading logo appeared.
 *
 * Historical note: this previously returned `null` to avoid a Clerk-era
 * SSR-bailout-to-CSR that kept the loader stuck for 2–5 s on mobile during
 * initial hydration. With Auth.js v5 + JWT sessions there is no such bailout,
 * so the loader unmounts the moment the page commits.
 *
 * The PageLoader carries `data-page-loader="1"` which the
 * NavigationOverlayController uses to hand off from the static
 * <NavigationOverlay /> with zero visual gap. The CSS rule
 * `body:has([data-page-loader="1"]) footer { visibility: hidden }` in
 * globals.css also hides the footer for the full loader lifetime.
 */
export default function Loading() {
  return <PageLoader static />;
}
