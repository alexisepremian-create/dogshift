# Native app: Google (and Apple) Sign-In blocked in the WebView

**Status:** Fixed (PRs #465, #466 — June 9 2026)

## Symptom

In the iOS Capacitor app, tapping "Continuer avec Google" showed Google's
**"Accès bloqué : la demande de DogShift ne respecte pas les règles de Google …
Erreur 403 : disallowed_useragent"** page instead of a login.

After wiring the native Google SDK, a second symptom appeared: the app **crashed**
on sign-in with `NSInvalidArgumentException — "Your app is missing support for the
following URL schemes: com.googleusercontent.apps.481452223716-0l7ati…"` even
though that scheme WAS present in the built app's Info.plist (verified via
`xcrun simctl get_app_container booted ch.dogshift.app` → `Info.plist`).

## Root cause

1. **WebView OAuth is blocked by Google.** Since 2021 Google refuses OAuth in
   embedded WebViews (`disallowed_useragent`). DogShift's app is a Capacitor
   *remote-URL* shell (loads `www.dogshift.ch` in a WKWebView), so the
   redirect-based `signIn("google")` runs inside the WebView → blocked. The
   custom `appendUserAgent: "DogShiftApp/Capacitor"` (added for Cloudflare) made
   it worse, but Google would block any WebView regardless.

2. **The crash was a trailing whitespace in the env var.** The Google SDK derives
   the expected callback URL scheme by reversing the iOS client ID it receives
   from `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID`. A trailing space/newline pasted into
   the Vercel env var made the *derived* scheme end with an invisible char, so it
   no longer matched the (clean) scheme in Info.plist → "missing URL scheme". The
   error text looked identical because the extra char is invisible.

## Fix

- Use the **native Google SDK** (`@capgo/capacitor-social-login`, Capacitor 7)
  to get a Google **ID token**, then bridge it to a new `"google-native"`
  Auth.js Credentials provider that verifies the token server-side
  (`google-auth-library`, `lib/auth/verifyGoogleIdToken.ts`) and upserts the user.
  `AuthFlow.handleGoogle` branches on `useIsNativeApp()`: native → SDK, web →
  unchanged redirect flow.
- iOS: added the iOS OAuth client's `REVERSED_CLIENT_ID` to
  `ios/App/App/Info.plist` `CFBundleURLTypes`.
- **`.trim()` the client IDs** before `SocialLogin.initialize()` so a stray
  whitespace in the env var can never break the scheme match again.

## Gotchas / what NOT to do again

- **CocoaPods `pod install` crashed** with `Unicode Normalization … ASCII-8BIT`.
  Fix: run with a UTF-8 locale — `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx cap sync ios`.
- `@codetrix-studio/capacitor-google-auth` only supports Capacitor ≤6 — do NOT
  use it on Cap 7. `@capgo/capacitor-social-login@7.x` is the Cap-7 line (8.x
  needs Cap 8).
- `NEXT_PUBLIC_*` client IDs are baked at **Vercel build time** and loaded by the
  app from prod — a JS-only fix needs a redeploy, NOT an Xcode rebuild.
- Never paste client IDs with a trailing newline; verify with a hexdump if a
  "missing URL scheme" appears despite the scheme being present.

## How to recognize a regression

- `disallowed_useragent` page on a social button inside the app → someone routed
  OAuth through the WebView instead of the native SDK.
- `"missing support for the following URL schemes"` crash → scheme mismatch
  (Info.plist vs the reversed client ID), usually a whitespace/typo in the env var.

## Related PRs

- PR #465 — native Google Sign-In (ID-token bridge), iOS pods + URL scheme
- PR #466 — trim client IDs (env whitespace fix)

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "Native iOS WebView + Google SDK behaviour — cannot be probed from a server-side cron. Verified through real-device / simulator QA."
}
```
