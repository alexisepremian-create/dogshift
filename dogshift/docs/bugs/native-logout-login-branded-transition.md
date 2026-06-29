# Native logout/login: auto-reconnect + skeleton/splash flash cascade

**Status:** Fixed (June 2026)

## Symptom

In the Capacitor iOS app:

1. **Logout didn't really log out.** After "Déconnexion", signing in again with
   Google/Apple silently reused the **same account** — no account chooser.
   Founder: *"si ça me déconnecte je puisse choisir quel compte je veux utiliser,
   sinon ça sert à quoi de me déconnecter ?"*
2. **Both transitions flashed a cascade of loaders.** Logout showed a **skeleton**
   then the purple splash. Login showed navbar → **skeleton** → purple → **skeleton**.
   Founder wants **only** the purple screen + paw logo for both.

## Root cause

1. **Auto-reconnect:** `/sign-out` cleared the Auth.js JWT cookie but **never
   cleared the native social session** (`SocialLogin.logout()` was called
   nowhere). The `@capgo/capacitor-social-login` Google/Apple session survived,
   so the next `SocialLogin.login()` returned the same account with no picker.

2. **Flash cascade:** Both flows do **hard navigations** (`window.location.replace`
   in `app/sign-out/page.tsx` and `app/(protected)/post-login/page.tsx`), and each
   transition crosses several independent loaders, each of which shows on native:
   - `/sign-out` + `/post-login` render `PageLoader` → a native **skeleton**.
   - The hard reload re-triggers the **cold-launch splash** (`html[data-native]::before/::after`).
   - The dashboard then shows its route-fallback skeleton + `HostDataGate` skeleton.
   - `GlobalNativeBottomNav` mounts mid-transition.

   A purpose-built `components/native/NativeBrandedLoader.tsx` (purple + paw,
   `z-index: 2147483646`) already existed but was **never wired up**.

## Fix

### Real logout
`app/sign-out/page.tsx` now clears the native social session before redirecting
(native only, `Promise.allSettled` over google + apple so an unsupported provider
never blocks):

```ts
const { SocialLogin } = await import("@capgo/capacitor-social-login");
await Promise.allSettled([
  SocialLogin.logout({ provider: "google" }),
  SocialLogin.logout({ provider: "apple" }),
]);
```

### One continuous branded cover
A sessionStorage-flag-driven cover (mirrors `lib/auth/signoutHandoff.ts`) wires up
`NativeBrandedLoader` so it survives the hard navigations:

- **`lib/native/authTransition.ts`** — `beginAuthTransition()` / `authTransitionActive()` /
  `endAuthTransition()` (flag in sessionStorage + `data-auth-transition` on `<html>` +
  begin/end window events).
- **`components/native/AuthTransitionCover.tsx`** (mounted in `app/layout.tsx`,
  native only) — renders `NativeBrandedLoader` while the flag is active; reads it
  on mount (covers hard-nav reloads) and on the begin event (client navs); clears
  on the end event or a **6 s failsafe**.
- **Begin:** `app/sign-out/page.tsx` (logout) and `components/auth/AuthFlow.tsx`
  before every `router.replace(callbackUrl)` success path (native only).
- **End:** `app/login/page.tsx` (once unauthenticated → reveal the account
  chooser), `components/HostDataGate.tsx` (sitter dashboard ready), and
  `components/OwnerDashboardShell.tsx` (owner dashboard ready).
- **CSS:** `html[data-auth-transition="true"]` hides the bottom nav
  (`nav[aria-label="Navigation principale"]`) + `#ds-nav-overlay` for the
  sub-frame before the cover paints.

### Follow-up 1 — splash must cover the signIn round-trip (login)
The cover was begun only **after** `signIn()` resolved, so during native token
verification the `/login` form repainted underneath (user "re-landed on login"
before the splash, which then appeared abruptly). `components/auth/AuthFlow.tsx`
now calls `beginAuthTransition()` the instant the native Google/Apple sheet
closes (right after the idToken, **before** `signIn`), and `endAuthTransition()`
in the signIn-failure branch so a failed login isn't stranded on purple.

### Follow-up 2 — "mini flash écran violet" = WKWebView bg during the hard-nav gap
The WKWebView `backgroundColor` is brand purple (`capacitor.config.ts`). A hard
`window.location.replace` tears down the document; during the commit gap iOS
paints that purple bg **without the logo** = a brief purple flash, on BOTH login
(`/post-login` → dashboard) and logout (`/sign-out` → `/login`). Fix: on native,
both hops are now **client-side** (`router.replace`) so the root-layout
`#ds-auth-splash` never unmounts — the logo is present the whole time. Web keeps
the hard nav (fresh session read). Safe because the session is already loaded at
`/post-login`, and the `SIGNOUT_HANDOFF` flag (not the hard reload) is what
prevents the `/login` logout-bounce.

## What NOT to do again

- Don't treat the Auth.js cookie clear as a full logout in the native app — the
  native OAuth session must be cleared too (`SocialLogin.logout`).
- Don't add yet another route-level loader for an auth hop. Both flows are masked
  end-to-end by the single flag-driven `AuthTransitionCover`; if you add a new
  post-login destination, call `endAuthTransition()` when its content is ready.
- Keep everything native-gated (`isNative` / `data-native`) — web auth is unchanged.
- Don't reintroduce `window.location.replace` for the native login/logout hops —
  the WKWebView's purple bg flashes (logo-less) during the hard-nav commit gap.
  Use `router.replace` on native so `#ds-auth-splash` stays mounted end-to-end.
- Don't begin the cover after `signIn()` — begin it the moment the native OAuth
  sheet closes, or `/login` repaints during token verification.

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "Bug UX natif WKWebView (transitions logout/login) + état session OAuth natif — pas reproductible côté serveur ni par cron. Couvert par tests/integrations/nativeAuthTransition.test.ts (le sign-out appelle SocialLogin.logout ; le cover branded est câblé begin/end). Vérifier manuellement sur iPhone après toute modif de app/sign-out, components/auth/AuthFlow.tsx, app/login, HostDataGate, OwnerDashboardShell ou lib/native/authTransition.ts."
}
```
