# E2E smoke "body too short" — Suspense fallback never resolves on preview

**Status:** Fixed by reverting the trigger (loading.tsx → null), PR after #371.

## Symptom

`tests/e2e/smoke.spec.ts` fails on every PR (regardless of the changes)
with:

```
Error: expected / to render >100 chars of body text, got 63
```

CI blocks auto-merge on all queued PRs.

## Root cause (final understanding)

PR #359 changed `app/(marketing)/loading.tsx` to render `<PageLoader static />`
instead of returning `null`. **On prod this is fine** — Suspense resolves in
a few hundred ms and the user sees the page.

**On Vercel preview deployments it never resolves within Playwright's 15 s
wait.** Combination of Neon cold start (preview Neon branches autosuspend
aggressively) + initial sitter query latency means the homepage Suspense
boundary stays unresolved for the whole test. Playwright sees only the
PageLoader's content (~63 chars) and the >100 chars assertion fails.

Crucially, the bypass header `x-vercel-protection-bypass` IS working — the
test reaches the real DogShift page. The 63 chars are the genuine PageLoader
content, not Vercel's auth page (which would also be ~63 chars but with
different text — verified by curl).

## Fix (actual)

**Revert the trigger.** Both `app/(marketing)/loading.tsx` and
`app/(marketing)/sitter/[sitterId]/loading.tsx` return `null` again. The
PageLoader fallback was a belt-and-suspenders for the footer flash that
the static `<NavigationOverlay />` + MutationObserver handoff
(`components/NavigationOverlayController.tsx`) already handles in 99 % of
cases.

If the footer flash regresses after this revert, the next attempt should
target the controller / overlay layer, NOT bring the Suspense fallback
back. See [`footer-flash-during-navigation.md`](./footer-flash-during-navigation.md).

### Attempts that DID NOT work (and why)

**PR #368** — added a Playwright helper that waited for
`[data-page-loader="1"]` to disappear before reading body.innerText.
Failed because `<PageLoader />` is a client component (`"use client"`)
and React adds the marker attribute on the wrapping `<div>` **after
hydration**. At `domcontentloaded` the attribute isn't there yet, the
wait resolved instantly, and body was still the loader SVG (~63 chars).

**PR #371** — replaced the marker wait with `await waitForFunction(() =>
document.body.innerText.length > 100, { timeout: 15_000 })`. Failed
because the Suspense boundary on the preview really doesn't resolve in
15 s. The wait timed out and the assertion still saw ~63 chars.

**Lessons for future-Claude**:
- Never use a client-component-added DOM attribute as a wait condition
  in a test that runs at `domcontentloaded` — the attribute isn't there
  yet.
- Don't assume "wait longer" fixes a Suspense fallback that the preview
  environment can't resolve. If prod-vs-preview parity matters for a
  test, ensure the preview can actually render the page (warm DB,
  proper env vars, no protection wall on top).
- The cheap fix is usually to remove the Suspense fallback content
  (return `null` from loading.tsx) rather than make the test smarter.

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
  "reason": "Bug de logique côté CI — pas un problème de prod runtime. Détecté directement par la CI qui plante sur chaque PR."
}
```
