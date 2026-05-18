# E2E smoke "body too short" — false positive due to Suspense fallback

**Status:** Fixed (PR #368, 2026-05-18)

## Symptom

`tests/e2e/smoke.spec.ts` fails on every PR (regardless of the changes)
with:

```
Error: expected / to render >100 chars of body text, got 63
```

CI blocks auto-merge on all queued PRs.

## Root cause

The smoke test does `page.goto(route, { waitUntil: "domcontentloaded" })`
then reads `body.innerText`. After PR #359, `app/(marketing)/loading.tsx`
renders `<PageLoader static />` instead of returning `null` — so at the
moment `domcontentloaded` fires, the only thing in the DOM is the loader
(~63 chars: "Chargement…" + alt text). The >100 chars assertion fails
even though the page is healthy.

This is a CI-only regression — production behavior is fine (and actually
improved, see [`footer-flash-during-navigation.md`](./footer-flash-during-navigation.md)).

## Fix (final form, PR #371)

Wait for `document.body.innerText.trim().length > 100` directly before
asserting. PageLoader's content is well under 100 chars (~63), so the
wait only resolves once the actual page has committed past the
Suspense boundary. 15 s timeout.

### First attempt that DID NOT work (PR #368)

I initially used `[data-page-loader="1"]` as a proxy — wait for the
attribute to disappear from the DOM. **That didn't work** because
`<PageLoader />` is a client component (`"use client"`) and React adds
the `data-page-loader` attribute on the wrapping `<div>` **after
hydration**, not in the SSR HTML. So
`document.querySelector('[data-page-loader="1"]')` was null at
`domcontentloaded`, the wait resolved instantly, and body was still
just the loader SVG (~63 chars).

**Lesson for future-Claude**: never use a client-component-added DOM
attribute as a wait condition in an e2e test that runs at
`domcontentloaded`. The attribute isn't there yet. Either:
- Wait for the assertion content directly (what we do now)
- Use `waitUntil: "networkidle"` or `"load"` instead of `"domcontentloaded"`
- Wait for a known SSR'd element specific to the destination page

## How to recognize a regression of this

- ANY new Suspense fallback that renders a "loader" component without
  the standard `data-page-loader="1"` marker will recreate the same
  symptom for routes covered by smoke tests
- "expected X to render >100 chars of body text" in CI on a PR that
  doesn't touch the relevant route

## What NOT to do when fixing it again

- Do NOT lower the >100 char threshold — it's there to catch real blank
  pages
- Do NOT replace `domcontentloaded` with `networkidle` blindly — that
  can hang on pages with long-polling sockets
- Do NOT remove `data-page-loader="1"` from `<PageLoader />` — the
  navigation overlay handoff AND the smoke test both depend on it

## Related PRs

- PR #359 — marketing `loading.tsx` → `<PageLoader static />` (introduced the regression)
- PR #368 — first (failed) attempt: wait for `data-page-loader` to disappear
- PR #371 — actual fix: wait for `body.innerText.length > 100` directly

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "CI test logic — not a runtime production bug. Detected by CI itself failing on every PR."
}
```
