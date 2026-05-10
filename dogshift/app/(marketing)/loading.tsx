/**
 * Marketing route loading state.
 *
 * Why `null`?
 * The homepage (and most marketing pages) are statically prerendered with
 * `revalidate = 300`. However, ClerkProvider in the root layout opts the tree
 * into dynamic features (cookies/headers) which can cause Next.js to bail
 * the page tree out to client-side rendering during SSR
 * (`BAILOUT_TO_CLIENT_SIDE_RENDERING`).
 *
 * When that happens, this `loading.tsx` is rendered as the Suspense fallback.
 * If we render a fullscreen `<PageLoader />`, it covers the entire viewport
 * with a spinner that only disappears once React finishes hydrating
 * client-side. On slow mobile devices that can be 2–5 seconds — long enough
 * that users perceive it as "infinite loading" (the splash never going away
 * even though the network is fine).
 *
 * Returning `null` means: during the SSR bailout, the user immediately sees
 * the marketing layout chrome (header, footer) with an empty content area,
 * which gets filled in the moment hydration completes. No fullscreen overlay
 * blocking interaction. No false "loading…" cue when the page is actually
 * already loaded.
 */
export default function Loading() {
  return null;
}
