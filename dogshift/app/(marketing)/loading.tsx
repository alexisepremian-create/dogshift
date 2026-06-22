/**
 * Marketing route loading state.
 *
 * WEB: returns a full-height empty SPACER (NativeRouteFallback web="spacer").
 * The homepage `Home()` is an async server component that `await`s
 * getFeaturedSitters() (a Neon read). With streaming SSR the layout (header +
 * footer) flushes first while `{children}` is pending → with a `null` fallback
 * the content region collapsed and the footer painted right under the header
 * ("I see the footer first before the page loads"). The spacer reserves one
 * viewport of height so the footer stays below the fold until content streams in.
 *
 * Why NOT `<PageLoader static />` here (see
 * `docs/bugs/e2e-smoke-body-text-too-short.md`): PageLoader carries
 * `data-page-loader="1"`, which the footer-flash CSS uses to hide header+footer
 * via `visibility:hidden`. On Vercel preview the homepage Suspense boundary
 * doesn't resolve within Playwright's 15 s (cold Neon), so the smoke test would
 * see only the loader (~63 chars) and the >100-char assertion fails. The spacer
 * has NO marker and NO text → header+footer text stays in `body.innerText`, so
 * smoke is unaffected, exactly like the old `null` path.
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
  return <NativeRouteFallback web="spacer" />;
}
