---
name: auth-flow
description: Work with DogShift's Auth.js v5 setup — signup, login, session reads, role-based gating, admin access. Use when adding/modifying auth routes, debugging session issues, or touching anything in lib/auth/, components/auth/, or app/api/auth/.
---

# Auth flow — Auth.js v5

## Stack snapshot

- **Library** : `next-auth@5.0.0-beta.31` + `@auth/prisma-adapter`
- **Session strategy** : `"jwt"` (NOT `"database"`) — Credentials provider is incompatible with database sessions
- **Config root** : `auth.ts` (repo root)
- **Providers** : Google OAuth (primary) + Credentials (email + bcrypt password)
- **Middleware** : `proxy.ts` (lightweight cookie check only — role checks happen in route handlers)
- **No Clerk** : migrated away May 2026. Any `@clerk/*` import is dead code.

## Reading the current user

### Server (route handlers, server actions, server components)

```ts
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";

const user = await getAuthedDbUser();
if (!user) {
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}
// user.id, user.email, user.name, user.role, user.sitterId
```

**Use `getAuthedDbUser()` 90 % of the time.** Do NOT call `await auth()` directly — wrap helper exists for a reason.

### Sitter-only endpoints (`/api/host/*`)

```ts
import { requireSitterOwner } from "@/lib/auth/requireSitterOwner";

const guard = await requireSitterOwner(req);
if (!guard.ok) return guard.response;
const { dbUserId, sitterId } = guard;
```

### Admin pages

```ts
import { requireAdminPageAccess } from "@/lib/adminAuth";

export default async function AdminFooPage() {
  await requireAdminPageAccess("/admin/foo"); // redirects if not admin
  return <div>…</div>;
}
```

### Admin API routes

```ts
import { getRequestAdminAccess } from "@/lib/adminAuth";

const admin = await getRequestAdminAccess(req);
if (!admin.isAdmin) {
  return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
}
```

### Client

```tsx
"use client";
import { useSession } from "next-auth/react";

const { data: session, status } = useSession();
const userId = session?.user?.id ?? null;
const role = (session?.user as { role?: string } | undefined)?.role ?? null;
```

## Admin gating (4-layer)

Admin access requires **ALL four** :

1. Authenticated Auth.js session (`session.user.id`)
2. `session.user.role === "ADMIN"` (re-read from DB on every JWT callback — propagates instantly)
3. `session.user.email` in `ADMIN_EMAILS` env (comma-separated)
4. Valid `ds_admin_session` cookie (hash of `HOST_ADMIN_CODE`)

Backend-to-backend alternative : `x-admin-code` header + `x-admin-email` header. Either layer alone is insufficient.

## Middleware (`proxy.ts`)

Only does :
1. Apex → www redirect (prod)
2. 410 Gone for retired URLs
3. Invite cookie gate for pilot signup
4. **Cookie presence check** for `/host`, `/account`, `/admin`, `/api/{host,account,admin}/*`

It does **NOT** validate sessions against the DB (Edge runtime — no Prisma). Role checks happen one layer down in route handlers / layouts.

**Gotcha** : adding a new route under `/api/{host,account,admin}/*` that auths via Bearer token (not session) → MUST whitelist in `BEARER_AUTH_API_PATHS` in `proxy.ts`. Otherwise 401 at middleware before the route runs (PRs #329, #335 burned on this).

## Why JWT, not database

Auth.js v5 Credentials provider is fundamentally incompatible with `session: { strategy: "database" }` — it never writes to the Session table, so `auth()` returns null on the first request after `signIn()`. Switched to JWT in PR #319.

Trade-off : JWT stays valid 30 days even after User deletion. Mitigated in the `jwt` callback by re-reading `User.role` from DB on every request → admin promotion / demotion / delete propagates instantly via empty token return.

## Password storage

`bcrypt.hash(password, 12)` everywhere. Documented in public privacy policy. Lowering the cost is a regression.

Reset-password endpoint also purges all `Session` rows for defense-in-depth (symbolic with JWT but kept for future flexibility).

## Tokens (email-verification + password-reset)

Both stored in `VerificationToken` table, distinguished by identifier prefix :
- `password-reset:<lowercased-email>` — 1 h TTL, sent by `/api/auth/forgot-password`
- `email-verification:<lowercased-email>` — 24 h TTL, sent at signup

The DB stores only `SHA-256(plaintext)`. The plaintext goes in the email link.

## Env vars

```bash
AUTH_SECRET=              # 32-byte base64 (npx auth secret)
AUTH_TRUST_HOST=true      # required behind Cloudflare
AUTH_GOOGLE_ID=           # Google OAuth Client ID
AUTH_GOOGLE_SECRET=       # Google OAuth Client Secret
ADMIN_EMAILS=             # comma-separated admin whitelist
HOST_ADMIN_CODE=          # strong password for ds_admin_session cookie
```

Google Cloud Console redirect URIs :
- `https://www.dogshift.ch/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google`

## Anti-patterns

- ❌ Add `@clerk/*` import — Clerk is GONE since May 2026
- ❌ Switch session strategy to `"database"` — breaks Credentials provider
- ❌ Skip `getAuthedDbUser()` and call `await auth()` directly — bypasses the convention
- ❌ Add a new admin route without verifying middleware whitelist
- ❌ Trust `session.user.role` in middleware (Edge — no DB) — read it in route handler instead
- ❌ Store passwords with bcrypt cost < 12 — privacy policy commitment
- ❌ Include sensitive data in URL params (leaks in referrers/logs)

## When debugging "I'm logged in but page redirects to /login"

1. Check `proxy.ts` — is the route in a protected prefix ?
2. Check the cookie : DevTools → Application → Cookies → look for `__Secure-authjs.session-token` (HTTPS) or `authjs.session-token` (HTTP)
3. Check the JWT contents : decode in jwt.io with `AUTH_SECRET`
4. Check `getRequestAdminAccess` logs (it writes `[adminAuth][getRequestAdminAccess] denied` with the failure mode breakdown)

## Where to look

- `auth.ts` — single config
- `lib/auth/getAuthedDbUser.ts` — main helper
- `lib/auth/requireSitterOwner.ts` — sitter gate
- `lib/adminAuth.ts` — admin 4-layer gate
- `lib/auth/passwordResetToken.ts` — token helpers
- `proxy.ts` — middleware
- `docs/AUTH.md` — official doc
