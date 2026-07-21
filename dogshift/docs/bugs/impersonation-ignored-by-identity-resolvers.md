# "Voir comme" (impersonation) shows the admin's own data, not the target's

**Status:** Fixed (2026-07-21) — all generic identity resolvers now funnel through `resolveEffectiveUserId()`.

## Symptom

An admin opens `/admin/impersonate`, clicks **"👁️ Voir comme"** on a user. The POST succeeds, the signed `ds_impersonate` cookie is set, and the browser lands on `/account` (owner) or `/host` (sitter) — but the page shows the **admin's own** account/dashboard, not the target's. The feature looks completely broken.

## Root cause

The impersonation cookie was honored in exactly one place: `getAuthedDbUser()`. But most of `/account` and `/host` resolve the current user through OTHER helpers, and every one of them read the identity straight from the real Auth.js session (`await auth()` → `session.user.id`), ignoring the cookie:

- `lib/userContexts.ts` → `getUserContexts()` (the `/account` shell + role context)
- `lib/auth/resolveDbUserId.ts` → `resolveDbUserId()` and `ensureDbUserFromClerkAuth()` (60+ API call sites, `getHostUserData` fallback)
- `lib/auth/requireSitterOwner.ts` → `requireSitterOwner()` (`/api/host/**` gate)

So the cookie switched identity only in the minority of call sites that happened to use `getAuthedDbUser()` directly. Everywhere else the admin stayed themselves → impersonation was effectively a no-op for the pages a human actually looks at.

Same meta-cause as the other recurring bugs in this folder: **one source of truth (the impersonation cookie) with many independent consumers, and no shared resolver keeping them in sync.**

## Fix

Add one shared, impersonation-aware resolver `resolveEffectiveUserId()` in `lib/auth/getAuthedDbUser.ts` and route every generic resolver through it:

```ts
export async function resolveEffectiveUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  if (cookieStore.get(IMPERSONATION_COOKIE)?.value) {
    const authed = await getAuthedDbUser(); // admin gate + target lookup + expiry
    return authed?.id ?? null;
  }
  const session = await auth();             // fast path: zero extra DB queries
  return session?.user?.id ?? null;
}
```

`getUserContexts`, `resolveDbUserId`, `ensureDbUserFromClerkAuth` and `requireSitterOwner` now all call it. Non-impersonating users pay only one extra (DB-free) cookie read → no Neon/compute regression.

## What NOT to do again

- **Don't resolve the current user from `auth()` / `session.user.id` in new shared helpers.** Use `resolveEffectiveUserId()` (or `getAuthedDbUser()` when you need the full row). Reading the raw session silently breaks impersonation.
- **Don't add the impersonation cookie check to a single new resolver and call it done** — it must live in the ONE shared function so all consumers inherit it.
- Writes that must NEVER act as the target (messages, Stripe, delete, password) are blocked separately by `isBlockedInImpersonation` in `proxy.ts` — that gate is independent of this fix and must stay.

## Regression test

`tests/integrations/impersonationIdentityResolvers.test.ts` — file-level asserts that each resolver references `resolveEffectiveUserId` and no longer resolves identity from a bare `auth()` session. Fails in CI if any resolver regresses to the raw session id.

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "Only reproduces at runtime for an admin with a live ds_impersonate cookie visiting /account or /host — an HTTP probe would need a signed impersonation cookie + admin session. The file-level asserts in tests/integrations/impersonationIdentityResolvers.test.ts catch the regression deterministically on every CI run."
}
```
