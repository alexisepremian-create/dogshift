# Footer flash during route transitions

**Status:** Fixed (latest fix 2026-05-18, PR #359 + foundations PR #320, #357)
**Recurrence count:** 3+ times. Treat as a long-standing sensitivity.

## Symptom

When the user clicks a `<Link>` (especially in the marketing area), the
footer of the layout briefly flashes through for ~1 frame before the
animated `<PageLoader />` appears. The user reads this as "the loading
isn't clean". Most visible on slower mobile devices.

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

## Fix (the only correct combination)

All three pieces must be present:

1. **Every reachable Suspense fallback MUST render `<PageLoader static />`.**
   Never `return null` from a `loading.tsx` file the user can hit. The
   Clerk-era reason for returning null no longer applies.
2. **`NavigationOverlayController` hands off to PageLoader via MutationObserver**
   (`components/NavigationOverlayController.tsx`). Soft failsafe at 6 RAFs
   (~100 ms) for static pages without a loader, hard upper bound 2 s.
   `<PageLoader />` itself carries `data-page-loader="1"` (added in PR #357).
3. **Two CSS rules in `app/globals.css` work together — never remove either:**
   ```css
   body[data-navigating="1"] footer { visibility: hidden; }
   body:has([data-page-loader="1"]) footer { visibility: hidden; }
   ```
   The first covers the static-overlay phase, the second covers the entire
   PageLoader lifetime including its 350 ms fade-out.

## How to recognize a regression of this

- Footer is visible for ~1 frame between Link click and the animated logo
- "Loading isn't clean" complaint
- Most visible on `/(marketing)/*` routes, especially `/sitter/[id]`

## What NOT to do when fixing it again

- Do NOT make `loading.tsx` return `null` "to speed things up" — that
  recreates the bug.
- Do NOT replace the MutationObserver with a fixed RAF count — that was
  the May 2026 regression.
- Do NOT remove the `:has([data-page-loader="1"])` CSS rule — the fade-out
  phase needs it.
- Do NOT change `<PageLoader />` to render conditionally without
  `data-page-loader="1"`. If you write a NEW page-level loader, give it
  this marker.

## Related PRs

- PR #284 — first attempt (lazy-mount overlay)
- PR #308 — perf: remove transition-all on footer icons (partial relief)
- PR #320 — static NavigationOverlay introduced
- PR #357 — controller handoff via MutationObserver
- PR #358 — sign-out reliability (related but distinct)
- PR #359 — marketing `loading.tsx` returns `<PageLoader static />`

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
