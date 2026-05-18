# Middleware blocks Bearer-auth API routes under protected prefixes

**Status:** Fixed (PR #329 maintenance-recap, PR #335 sitter activation)
**Recurrence count:** 2 times. Will recur every time someone adds a new
Bearer-auth route under a protected prefix without updating `proxy.ts`.

## Symptom

A new `/api/host/*`, `/api/account/*`, or `/api/admin/*` route returns
`{"ok":false,"error":"UNAUTHORIZED"}` even though the request includes a
valid Bearer token. The route handler is never reached.

## Root cause

`proxy.ts` (Next.js 16 middleware) protects everything under
`/api/host/*`, `/api/account/*`, `/api/admin/*` by requiring an Auth.js
session cookie. Routes that authenticate via Bearer token instead (cron
jobs, GitHub Actions deps-agent, sitter activation code, etc.) get
401'd by the middleware before their handler can verify the bearer.

## Fix

Add the route's exact path to `BEARER_AUTH_API_PATHS` in `proxy.ts`:

```ts
const BEARER_AUTH_API_PATHS = new Set([
  "/api/admin/maintenance/report", // Bearer MAINTENANCE_API_KEY (GitHub Actions)
  "/api/host/activation-code",     // DS-XXXX-XXXX code itself is the proof
]);
```

The route handler stays responsible for verifying the bearer / token —
the whitelist only bypasses the cookie check.

## How to recognize a regression

- 401 with `{"ok":false,"error":"UNAUTHORIZED"}` (middleware shape) instead
  of the route's expected error shape.
- The route works fine locally with a session cookie but fails from cron /
  GitHub Actions / external services.

## What NOT to do

- Do NOT move the route out of `/api/{admin,host,account}/*` to dodge the
  middleware — those prefixes have other meaning (routing conventions,
  permissions audit, etc.).
- Do NOT relax the middleware to accept Bearer tokens generically — each
  Bearer route has its own secret and validation logic.

## Related PRs

- PR #329 — `/api/admin/maintenance/report` whitelisted
- PR #335 — `/api/host/activation-code` whitelisted

## 🤖 Automated detection

```json
{
  "type": "http",
  "url": "https://www.dogshift.ch/api/host/activation-code",
  "expect_status": 405,
  "expect_not_contains": "UNAUTHORIZED",
  "auto_fix": { "complexity": "simple" }
}
```

GET on `/api/host/activation-code` (a Bearer-auth route) without any cookie
or Authorization header. Expected: 405 Method Not Allowed (the handler exists,
middleware let the request through, only POST is supported). If the middleware
regressed and started blocking again, we'd see 401 `UNAUTHORIZED` instead.

Auto-fix **simple**: the patch is always "add the missing path back to
`BEARER_AUTH_API_PATHS` in `proxy.ts`". A future patch script could grep the
recent diff for the removed path and restore it.
