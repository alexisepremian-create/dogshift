# Homepage: footer shows first on initial (hard) load, before content

**Status:** Fixed (June 2026)
**Related:** [`footer-flash-during-navigation.md`](./footer-flash-during-navigation.md) (the *navigation* variant) and [`e2e-smoke-body-text-too-short.md`](./e2e-smoke-body-text-too-short.md) (the constraint).

## Symptom

On a hard load / first arrival on `https://www.dogshift.ch/` (web), the very
first thing visible is the **footer** (links, payment logos, copyright) sitting
right under the header — before the hero/map/sitter content appears. Distinct
from the navigation footer-flash (that one is on `<Link>` clicks).

## Root cause

The homepage `Home()` (`app/(marketing)/page.tsx`) is an **async server
component** that `await`s `getFeaturedSitters()` (a Neon query). With streaming
SSR, `app/(marketing)/layout.tsx` (header + footer, no awaits) flushes
immediately while `{children}` is still pending. The Suspense fallback for that
window is `app/(marketing)/loading.tsx`, which on **web returned `null`**. With a
null fallback the content region has zero height, so the footer collapses up to
just under the header until the DB read resolves and the page streams in.

## Fix

Web Suspense fallback now reserves one viewport of height instead of `null`:
`NativeRouteFallback` gained a `web="spacer"` mode that renders
`<div aria-hidden className="min-h-screen bg-white" />`, and
`app/(marketing)/loading.tsx` uses it. The footer stays below the fold until the
content streams in. Native paths (skeletons) are unchanged.

## What NOT to do again

- Do **NOT** use `<PageLoader static />` (or anything with `data-page-loader="1"`)
  as the marketing web fallback. That marker triggers the footer-flash CSS
  (`body:has([data-page-loader="1"]) header,footer { visibility:hidden }`), which
  removes header+footer text from `body.innerText`. On cold-Neon previews the
  homepage Suspense never resolves within Playwright's 15 s, so the smoke test's
  `>100 chars` assertion fails on every PR. The spacer has **no marker and no
  text**, so header+footer text stays in `innerText` — smoke-safe, like the old
  `null`.
- Keep the spacer empty (no copy) — adding text is unnecessary and risks the
  smoke threshold semantics.

## How to recognize a regression

- "I see the footer first before the page loads" on the homepage hard refresh.
- `app/(marketing)/loading.tsx` returning `null` again (the footer collapses up).

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

The homepage must still render normally (200 + the static nav-overlay marker).
The footer-first flash itself is a streaming-timing/visual issue not reliably
probeable over HTTP; the >100-char invariant is guarded by the e2e smoke test.
```
