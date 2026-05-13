# Authentication — DogShift

> Updated May 13, 2026 — after the Clerk → Auth.js v5 migration was completed and Clerk was uninstalled. If this doc is older than 3 months when you read it, treat it as suspect and cross-check the code.

DogShift uses **Auth.js v5** (`next-auth@5.0.0-beta.31`) with the `@auth/prisma-adapter`. **There is no Clerk.** If you find any reference to `@clerk/*`, `CLERK_SECRET_KEY`, `clerkClient`, or the `clerkUserId` column, it is stale — open an issue or fix it.

## TL;DR

- **Session strategy: `"jwt"`** (NOT `"database"`). Required because the Credentials provider does not persist to the `Session` table.
- **Two providers**: `Google` (OAuth, primary) and `Credentials` (email + bcrypt password).
- **Single config**: `auth.ts` at repo root.
- **Single helper for "who is this request"**: `getAuthedDbUser()` from `@/lib/auth/getAuthedDbUser`. Reach for it 90 % of the time.
- **Middleware is light**: `proxy.ts` only checks for a session cookie; role-based authorization happens in route handlers / layouts / `lib/adminAuth.ts`.

## Environment variables

In `.env.local` (and on Vercel for production / preview):

```bash
AUTH_SECRET=              # 32-byte base64, generate with `npx auth secret`
AUTH_TRUST_HOST=true      # required behind Cloudflare proxy
AUTH_GOOGLE_ID=           # Google OAuth Client ID (can fall back to GOOGLE_CLIENT_ID)
AUTH_GOOGLE_SECRET=       # Google OAuth Client Secret
ADMIN_EMAILS=             # comma-separated whitelist (e.g. alexis.epremian@gmail.com)
HOST_ADMIN_CODE=          # strong password for the admin gate cookie
```

Google Cloud Console must list these as **Authorized redirect URIs** for the OAuth client:

- `https://www.dogshift.ch/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google`

## File map

| Concern | File |
|---|---|
| Single auth config | `auth.ts` |
| Type augmentation | `next-auth.d.ts` |
| Auth.js HTTP handler | `app/api/auth/[...nextauth]/route.ts` |
| Sign-up endpoint | `app/api/auth/register/route.ts` |
| Forgot password | `app/api/auth/forgot-password/route.ts` |
| Reset password | `app/api/auth/reset-password/route.ts` |
| Change password while signed in | `app/api/auth/set-password/route.ts` |
| Post-login role-based redirect | `app/api/auth/resolve-redirect/route.ts` |
| Daily health check (cron) | `app/api/cron/auth-health-check/route.ts` |
| **Main server helper** | `lib/auth/getAuthedDbUser.ts` |
| Legacy bridge helpers | `lib/auth/resolveDbUserId.ts` |
| Sitter-only API gate | `lib/auth/requireSitterOwner.ts` |
| Admin gate (belt + suspenders) | `lib/adminAuth.ts` |
| Password reset token helpers | `lib/auth/passwordResetToken.ts` |
| User context for pages | `lib/userContexts.ts` |
| Login UI | `components/auth/LoginForm.tsx` |
| Signup UI | `components/auth/SignUpForm.tsx` |
| Session provider | `components/SessionAuthProvider.tsx` |
| Middleware | `proxy.ts` (root — Next.js 16 naming, NOT `middleware.ts`) |

## Session strategy: why JWT, not database

Auth.js v5's `Credentials` provider is fundamentally incompatible with `session: { strategy: "database" }`. The adapter never writes credential-authorized users to the `Session` table, so `auth()` returns `null` on the request immediately after a successful credentials `signIn()` — which made `/post-login` bounce users back to `/login?force=1` in PR #317. PR #319 fixed this by switching to `"jwt"`.

**The trade-off:** JWT sessions stay valid for their full lifetime (30 days by default) even after the User row is deleted or the password is rotated. We mitigate this in the `jwt` callback by re-reading `User.role` from the DB on every request:

```ts
async jwt({ token, user }) {
  if (user?.id) token.sub = user.id;
  const userId = typeof token.sub === "string" ? token.sub : null;
  if (userId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!dbUser) return {};         // user deleted → empty token forces re-login
    (token as { role?: string }).role = dbUser.role;
  }
  return token;
}
```

This makes admin promotion/demotion take effect instantly (no re-login required) and gives us instant logout-on-delete. We do not need database sessions to get those properties.

## Reading the current user in code

### Server components, route handlers, server actions

```ts
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";

export async function POST() {
  const user = await getAuthedDbUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  // user.id, user.email, user.name, user.role, user.sitterId
}
```

For sitter-only endpoints (`/api/host/*`), use `requireSitterOwner(req)` instead — it returns `{ ok, dbUserId, sitterId }` after verifying the user has a `SitterProfile`.

For admin pages, call `requireAdminPageAccess()` at the top of the server component — it `redirect()`s unauthenticated users and enforces the four-factor admin gate (session + role + email whitelist + HOST_ADMIN_CODE cookie).

### Client components

```tsx
"use client";
import { useSession } from "next-auth/react";

export default function MyComponent() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  // status === "loading" | "authenticated" | "unauthenticated"
}
```

## Middleware

`proxy.ts` (root) does **only**:

1. Apex redirect (`dogshift.ch` → `www.dogshift.ch`) in production.
2. Return 410 Gone for retired URLs.
3. Invite-cookie gate for the pilot signup pages.
4. **For protected prefixes** (`/host`, `/account`, `/admin`, `/api/host/`, `/api/account/`, `/api/admin/`): if no session cookie is present, redirect to `/login?next=…` (or 401 JSON for `/api/*`).

It does **not** validate the session against the DB — that requires Prisma, which doesn't run in the Edge runtime. Validation + role checks happen one layer down, in the route handler / layout / `requireAdminPageAccess()` call.

## Admin gate

Implemented in `lib/adminAuth.ts`. Admin access requires **all four** of:

1. An authenticated Auth.js session (`session.user.id`).
2. `session.user.role === "ADMIN"` (read from the JWT token, which mirrors the DB).
3. `session.user.email` is in `ADMIN_EMAILS` (comma-separated env var).
4. The `ds_admin_session` cookie holds a valid `HOST_ADMIN_CODE` hash.

For backend-to-backend admin calls (no session available), the alternative is header-based: `x-admin-code` (must match `HOST_ADMIN_CODE`) **and** `x-admin-email` (must be in `ADMIN_EMAILS`). Either layer alone is insufficient.

## Password storage

`bcrypt.hash(password, 12)` everywhere. Documented in the public privacy policy ("mots de passe stockés sous forme de hash bcrypt"). Lowering the cost is a regression.

The reset-password endpoint also purges all `Session` rows for the user as a defense-in-depth against credentials leak — although with JWT strategy this is symbolic for now (the JWT cookie is the actual auth artifact).

## Email-verification + password-reset tokens

Both use the same `VerificationToken` table, distinguished by `identifier` prefix:

- `password-reset:<lowercased-email>` — 1 h TTL, sent by `/api/auth/forgot-password`.
- `email-verification:<lowercased-email>` — 24 h TTL, sent at signup time by `/api/auth/register`.

The DB stores only `SHA-256(plaintext)`. The plaintext is the random value sent in the email link.

## Skip lists

For the navigation-progress overlay (`NavigationOverlayController`):

```
/login, /signup, /sign-out, /post-login, /check-email,
/forgot-password, /reset-password, /verify-email
```

These are intentionally not masked because they are essentially instant micro-pages.

## Tests

- `tests/auth/passwordHash.test.ts` — bcrypt cost 12 round-trip + reject wrong password + salt randomness.
- `tests/auth/passwordResetToken.test.ts` — token format, expiry, identifier scoping.
- `tests/auth/resetPasswordSchema.test.ts` — Zod schema (8+ chars, uppercase, digit).
- `tests/e2e/auth.spec.ts` — Playwright smoke: login form renders, accepts input, surfaces errors. **Note**: `tests/e2e/global-setup.ts` is a no-op since the Clerk migration — authenticated e2e tests skip themselves when storage-state files are absent. Re-enable later by driving the UI login flow or inserting a `Session` row directly via Prisma.

## Historical context (Clerk migration)

Before May 2026, DogShift used Clerk for auth. The migration happened over three PRs:

- **#316** — Installed Auth.js v5 infrastructure alongside Clerk (no behaviour change).
- **#317** — Switched the active auth provider to Auth.js. 95 files migrated.
- **#319** — Hotfix: `session.strategy` switched from `"database"` to `"jwt"`.
- **#324** *(in this repo, see git log)* — Uninstalled Clerk packages, dropped `clerkUserId` column, removed all legacy routes.

The migration ran on 28 real Clerk users via `scripts/migrate-clerk-users.ts --apply` on May 12, 2026. 39 of 39 users received the migration-notice email. 16 had Google OAuth pre-linked (no friction); 12 had to use `/forgot-password` to set a new password.

The Clerk subscription was cancelled May 13, 2026.
