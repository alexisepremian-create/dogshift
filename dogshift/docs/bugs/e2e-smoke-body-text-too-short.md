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

## Fix

Add a small helper in the smoke test that waits for
`[data-page-loader="1"]` to disappear from the DOM before reading body
text. 10 s timeout, silently expires on routes that never mount the
loader (login, signup, cgu, etc.) so static pages stay fast.

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
- PR #368 — smoke test waits for loader to unmount (this fix)

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "CI test logic — not a runtime production bug. Detected by CI itself failing on every PR."
}
```
