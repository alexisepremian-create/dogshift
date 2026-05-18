# Logout bounce back to /post-login

**Status:** Fixed (PR #360, 2026-05-18)

## Symptom

User clicks "Se déconnecter". `/sign-out` page runs, briefly shows the
"Déconnexion…" loader, then arrives at `/login`. Within ~1 second, the
user is silently bounced back to `/post-login` and ends up in the dashboard
they tried to leave. The user reports "la déconnexion ne marche pas".

## Root cause

`/login` has an auto-redirect for the convenient "already-signed-in user
visits /login" case:

```ts
useEffect(() => {
  if (!isLoaded) return;
  if (!isSignedIn) return;
  router.replace("/post-login");
}, [isLoaded, isSignedIn, router]);
```

`useSession()` from `next-auth/react` exposes a cached `data` field. After
`/sign-out` hard-navigates to `/login`, the SessionProvider mounts fresh
and fires `/api/auth/session`. During the ~1 network roundtrip before the
fetch resolves, `useSession()` can briefly report
`{ status: "authenticated", data: <cached> }` from the previous mount —
which makes the auto-redirect fire. By the time `useSession()` updates to
`unauthenticated` the user is already gone.

Historical context: the old logout URL included `?force=1`, which was
read by `LoginPage` to skip the auto-redirect (`if (forceMode && ...) return`).
PR #359 removed `?force=1` from logout buttons (to also remove the visible
"Déconnexion en cours…" popup it spawned) — that removal exposed the
underlying race.

## Fix

`lib/auth/signoutHandoff.ts` exposes a one-shot sessionStorage flag.

1. `/sign-out` writes `ds_signout_handoff_ts = Date.now()` to
   sessionStorage **just before** `window.location.replace()`.
2. `/login` reads + consumes the flag on first render via
   `consumeSignoutHandoff()`. If the flag is present and fresh (<10 s),
   the auto-redirect effect is suppressed for this mount only.
3. The flag is removed on read so it's truly one-shot — a future `/login`
   visit without a `/sign-out` preceding it gets the usual auto-redirect.

sessionStorage survives the hard navigation (unlike React state) and is
tab-scoped, so no cross-tab leakage. The read is synchronous, so it
happens before any `useEffect` that could race against it.

## How to recognize a regression of this

- "Logout doesn't work" — user clicks Se déconnecter, ends up back in
  the dashboard with no error.
- The `/login` URL appears in the browser address bar momentarily before
  being replaced by `/post-login`.

## What NOT to do when fixing it again

- Do NOT remove `consumeSignoutHandoff()` from `LoginPage`. The auto-redirect
  is otherwise racy.
- Do NOT remove `markHandoff()` from `/sign-out`. The flag is what the
  login page depends on.
- Do NOT reintroduce `?force=1` to logout URLs — it spawned the visible
  "Déconnexion en cours…" popup that the user hated.
- Do NOT remove the auto-redirect from `/login` entirely. It's the
  intended UX for "user already signed in clicks /login by mistake".

## Related PRs

- PR #296 — earlier logout fix (manual cookie clearing + auto-retry)
- PR #301 — hide login form while force sign-out is in progress
- PR #358 — make `/sign-out` reliable (immediate redirect after `signOut()`)
- PR #359 — drop `?force=1` from logout URLs (introduced the bounce regression)
- PR #360 — handoff flag (this fix)
