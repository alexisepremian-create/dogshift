# Footer / header flash during route transitions

**Status:** Fixed (latest stable form: PR #374, 2026-05-19). User-confirmed working.
**Recurrence count:** 4 times across 2026. Treat as a long-standing sensitivity.

## Symptom

When the user clicks a `<Link>` (especially in the marketing area), the
footer (and sometimes header elements) briefly flash through during the
route transition. Users describe it as "loading isn't clean" or "le footer
apparaît puis disparaît". Most visible on slow mobile devices and on
homepage navigations (heavy initial data load).

A related symptom: the animated logo in the navigation overlay sometimes
gets cut off mid-animation on fast navigations because the overlay
disappears before the brand pulse completes.

## Root cause (final form)

Three failure modes converged into the same visible symptom:

1. **No Suspense fallback on the marketing routes.** `app/(marketing)/loading.tsx`
   and `app/(marketing)/sitter/[sitterId]/loading.tsx` returned `null`
   (a Clerk-era SSR-bailout workaround that is no longer needed since the
   Auth.js v5 migration). With a null fallback the layout chrome
   (header + empty content + footer) was visible until the page's own
   internal `<PageLoader />` mounted.
2. **Static `<NavigationOverlay />` cleared too early.** The original
   controller (PR #320) cleared the overlay 2 RAFs (~32 ms) after the
   `pathname` changed — before the Suspense fallback had a chance to
   commit. PR #357 replaced the fixed-RAF clear with a `MutationObserver`
   that waits for `[data-page-loader="1"]` to appear (handoff).
3. **PageLoader fade-out reveals footer.** Once the static overlay had
   handed off, the PageLoader's 350 ms opacity fade revealed the footer
   behind it.

## Fix (final stable form, PR #374)

Four moving parts. **All four must be in place** — removing any one
brings back at least one variant of the flash:

1. **`loading.tsx` files return `null`** for routes hit by the e2e smoke
   test (marketing + sitter detail). Do NOT render `<PageLoader static />`
   as a Suspense fallback — the Suspense boundary doesn't resolve fast
   enough on Vercel preview and the smoke test always sees ~63 chars
   (see [`e2e-smoke-body-text-too-short.md`](./e2e-smoke-body-text-too-short.md)).
2. **`NavigationOverlayController` hands off to internal PageLoader via
   MutationObserver** (`components/NavigationOverlayController.tsx`).
   Pages that render their own loader (sitter detail when
   `sitter === undefined`) get instant handoff via `data-page-loader="1"`.
   Soft failsafe 6 RAFs (~100 ms), hard upper bound 2 s.
3. **Minimum overlay duration `MIN_OVERLAY_MS = 600 ms`.** Even if
   content commits faster, the overlay holds for at least this long so:
   - The brandPulse SVG animation completes one cycle instead of
     flicker-and-gone (fixes the user-reported "animation cut off" issue)
   - All layout chrome (header + footer) stays masked through any
     re-render storm during hydration
4. **CSS hide covers BOTH header and footer**, with three orthogonal
   triggers — any one is enough:
   ```css
   body[data-navigating="1"] footer,
   body[data-nav-cooldown="1"] footer,
   body:has([data-page-loader="1"]) footer,
   body[data-navigating="1"] header,
   body[data-nav-cooldown="1"] header,
   body:has([data-page-loader="1"]) header {
     visibility: hidden;
   }
   ```
   - `data-navigating` — overlay-aligned, cleared when controller hands off
     AND `MIN_OVERLAY_MS` has elapsed (whichever is later)
   - `data-nav-cooldown` — set on click + cleared after a fixed window
     (`FOOTER_HIDE_MS = MIN_OVERLAY_MS = 600 ms`). Aliased to keep the
     two windows aligned.
   - `:has(PageLoader)` — entire PageLoader lifetime including 350 ms
     fade-out.

## How to recognize a regression of this

- Footer or header elements visible for ~1 frame between Link click and
  the animated logo
- "Loading isn't clean" / "le logo bug / footer apparaît" complaint
- Animation cut off mid-cycle on fast navigations (logo barely renders
  before disappearing)
- Most visible on `/(marketing)/*` routes, especially navigating
  between homepage and `/sitter/[id]`

## What NOT to do when fixing it again

- Do NOT render `<PageLoader static />` from `app/(marketing)/loading.tsx`
  or any other Suspense fallback hit by smoke. It breaks e2e on every
  Vercel preview (Suspense doesn't resolve in 15 s on cold Neon).
- Do NOT replace the MutationObserver with a fixed RAF count — that was
  the May 2026 regression that flashed the footer in 1 frame.
- Do NOT remove any of the THREE CSS triggers (`data-navigating`,
  `data-nav-cooldown`, `:has([data-page-loader="1"])`). They each cover
  a different window; removing one reopens that gap.
- Do NOT drop `MIN_OVERLAY_MS` below ~400 ms — the brand pulse animation
  needs time to render and the post-overlay-clear gap reopens.
- Do NOT change `<PageLoader />` to render conditionally without
  `data-page-loader="1"`. If you write a NEW page-level loader, give it
  this marker.
- Do NOT add new "fast" routes to `SKIP_PATHS` in the controller — the
  overlay is part of the consistent feel.

## Related PRs (full chronology)

- PR #284 — first attempt (lazy-mount overlay)
- PR #308 — perf: remove transition-all on footer icons (partial relief)
- PR #320 — static `<NavigationOverlay />` introduced
- PR #357 — controller handoff via MutationObserver on `data-page-loader`
- PR #358 — sign-out reliability (related but distinct)
- PR #359 — marketing `loading.tsx` → `<PageLoader static />` (introduced
  the e2e regression — see `e2e-smoke-body-text-too-short.md`)
- PR #368 — first failed attempt at fixing the e2e (waited for marker
  attribute that's added post-hydration)
- PR #371 — second failed attempt (waited for body text growth, Suspense
  never resolved in the 15 s window)
- PR #372 — revert `loading.tsx` to `null`, fixed e2e but resurrected
  the flash
- PR #373 — added `data-nav-cooldown` attribute (fixed flash for pages
  without internal PageLoader)
- PR #374 — added `MIN_OVERLAY_MS = 600 ms` + extended hide to header
  (fixed animation cut-off + header flicker, **current stable form**)

## 🤖 Automated detection

```json
{
  "type": "http",
  "url": "https://www.dogshift.ch/",
  "expect_status": 200,
  "expect_contains": "ds-nav-overlay",
  "auto_fix": { "complexity": "complex" }
}
```

Fetches the homepage and asserts the static `<NavigationOverlay />` element is
in the SSR HTML. If it disappears (someone removed it from the root layout, or
its id was renamed), the cron flags a regression. Auto-fix marked **complex**
because the right repair depends on what was removed — humans only.
