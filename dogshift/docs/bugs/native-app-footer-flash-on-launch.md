# Native app cold launch shows footer instead of the homepage

**Status:** Fixed 2026-06-05. First production occurrence reported by the
founder while testing the Capacitor iOS build in the Xcode simulator.
**Severity:** Visual / brand only — no data corruption. But it's the very
first impression on app launch, so it counts as a P1.

## Symptom

When the user taps the DogShift app icon on iOS (or Android), the native
splash screen plays for 1.5 s (configured via
`capacitor.config.ts → SplashScreen.launchShowDuration`) then disappears.
Instead of seeing the native map home, the user sees:

- The `SiteHeader` at the top (DogShift logo + hamburger + user icon)
- A huge empty white area
- The web marketing footer (DogShift brand block, social icons, payment
  logos, "Produit / Légal / Contact" columns, copyright line)

…all squished together as if the homepage had no content at all. The state
lasts anywhere from 200 ms to 5+ s depending on connection speed and Neon
cold-start latency, then the native map home eventually appears below the
header.

Founder quote (2026-06-05): *"déjà quand je lance l'appli ca me met ca
regarde mon screen c'est pas normal"*.

## Root cause

Three independent layers conspired:

1. **Capacitor remote-URL mode loads the same HTML as the web.** The native
   app is configured with `server.url = "https://www.dogshift.ch"`. The
   WebView loads the regular Next.js SSR output, which serves the full
   marketing layout (header + Suspense(children) + footer) — there is no
   server-side awareness that the request comes from a native shell.

2. **`app/(marketing)/loading.tsx` returns `null`.** This is intentional
   (see [`e2e-smoke-body-text-too-short.md`](./e2e-smoke-body-text-too-short.md))
   to keep the e2e smoke test passing on Vercel preview deployments. The
   Suspense fallback for the homepage is therefore empty.

3. **Native vs. web detection is client-side only.** `useIsNativeApp()`
   sets `data-native="true"` on `<body>` inside a `useEffect`, which only
   runs AFTER React has hydrated. `<NativeHomeSwitch>` likewise only swaps
   in `<NativeMapHome>` from a `useEffect`, post-hydration.

The cold-launch frame budget:

```
T=0      app icon tapped
T=0      native iOS splash screen visible (purple #7c3aed)
T=1500ms native splash auto-hides (launchAutoHide: true)
T=1500ms WebView visible — already painted the SSR HTML it received
         from Vercel. That HTML contains:
           <SiteHeader />            ← visible
           <Suspense fallback={null}>← empty (Neon cold start blocks here)
             <Home /> (RSC)
           </Suspense>
           <footer>...</footer>      ← visible
T=Xms    Home RSC streams in, Suspense closes, content appears
T=Yms    React hydrates, useEffect runs, isNative=true
T=Zms    <NativeHomeSwitch> swaps children → <NativeMapHome /> rendered
```

Between `T=1500ms` and `T=Zms` the user sees header + empty + footer.

## Fix (PR shipped 2026-06-05)

Bridge the gap between native splash hide and React's native-mode
detection by:

1. **Inline `<head>` script that detects Capacitor synchronously**
   (`app/layout.tsx`). Capacitor injects `window.Capacitor` at
   `documentStart` (WKUserScript on iOS, equivalent on Android), so the
   global is available before any of the page's own `<script>` tags
   execute. The inline script reads `Capacitor.isNativePlatform()` and
   sets `data-native="true"` on `<html>` (and mirrors to `<body>` via
   RAF once it exists, so the existing `body[data-native="true"]` rules
   keep working).

2. **Purple splash overlay in CSS** (`app/globals.css`). A
   `::before` pseudo-element on `html[data-native="true"]` paints a
   full-viewport purple panel (`#7c3aed` — same colour as the native
   launch screen, for visual continuity). The overlay sits at
   `z-index: 2147483646` so it covers EVERYTHING the WebView paints,
   including the SiteHeader and the footer.

3. **Reveal the overlay after the bridge init completes**
   (`lib/native/capacitorBridge.ts`). Once `SplashScreen.hide()` has
   resolved AND status-bar styling is applied, the bridge sets
   `data-native-ready="true"` on `<html>`. The CSS rule
   `html[data-native][data-native-ready]::before { opacity: 0 }` fades
   the overlay out in 200 ms, revealing the (now-hydrated) NativeMapHome
   underneath.

4. **Hide the marketing footer entirely in native mode**
   (`html[data-native] footer { display: none !important }`). Belt-and
   -suspenders: even if the overlay logic ever fails, the footer
   doesn't reach the user. The footer is also wrapped in `<WebOnly>` in
   `app/(marketing)/layout.tsx` for the post-hydration state — the CSS
   rule covers the pre-hydration window.

## How to recognize a regression

- Launch the Capacitor iOS app from the home screen (or via Xcode →
  Run). After the purple splash, you should land directly on the
  native map home (NativeMapHome) — never on a screen showing the
  marketing footer with "DogShift / La plateforme de confiance / Produit
  / Légal / Contact" sections.
- DevTools (Safari → Develop → iOS Simulator → DogShift) → Elements
  inspector: `<html data-native="true" data-native-ready="true">` after
  load. If `data-native-ready` is missing, the bridge init failed
  somewhere.
- Public web (`dogshift.ch` in a desktop browser) MUST behave exactly
  as before — no purple overlay, no hidden footer, no extra HTML.

## What NOT to do when fixing it again

- **Do NOT rely solely on `useIsNativeApp()` / `<WebOnly>` to hide
  native-incompatible UI on cold launch.** Both fire post-hydration,
  which is too late by 200 ms-5 s on cold Neon connections.
- **Do NOT remove the inline `<head>` script** from `app/layout.tsx`
  even if it looks "redundant" with `useIsNativeApp()`. The two work
  together: the script covers the pre-hydration window, the hook
  covers the post-hydration state.
- **Do NOT change the overlay colour without also changing
  `capacitor.config.ts → SplashScreen.backgroundColor`**. The whole
  point is visual continuity between the native splash and the CSS
  overlay — if the colours diverge there's a 1-frame colour flash at
  `T=1500ms` and another at `T=Zms`.
- **Do NOT set `launchAutoHide: false`** as an alternative fix. If the
  Capacitor JS bridge ever fails to load (offline, breaking JS error,
  the user is on `/login` which throws before mount), the native
  splash would stay up forever and the user is stuck. The current
  belt-and-suspenders design (auto-hide native splash + CSS overlay
  takes over) recovers cleanly: even if `data-native-ready` is never
  set, the overlay just stays opaque and the user can force-quit and
  retry, with the homepage available on next launch attempt.
- **Do NOT add `appendUserAgent: "DogShiftNative"` to
  `capacitor.config.ts`** without also auditing every UA-sniffing path
  in the codebase + the Vercel WAF rules. Server-side native detection
  would be the cleanest long-term fix, but it's a bigger change than
  what this bug warranted.

## Long-term follow-up

If we ever exit pilot mode and the app gets significant traffic, the
right architectural fix is server-side UA detection:

1. Add `appendUserAgent: "DogShiftNative/1.0"` to `capacitor.config.ts`
   (both `ios:` and `android:` blocks).
2. `npx cap sync && npx cap copy` and rebuild both apps.
3. In `proxy.ts`, sniff the UA and set a `x-dogshift-native` request
   header for the route handlers.
4. `app/(marketing)/page.tsx` reads the header via `headers()` and
   bypasses the marketing layout entirely on native — renders just a
   skeleton + `<NativeMapHome />` Suspense.

This would shave the SSR + hydration overhead too, not just the visual
flash. But it requires a coordinated client + server + native rebuild,
so we shipped the client-only fix first.

## Related PRs

- This PR — initial fix (inline head script + CSS overlay + bridge
  flag).

## 🤖 Automated detection

```json
{
  "type": "http",
  "url": "https://www.dogshift.ch/",
  "expect_status": 200,
  "expect_contains": "data-native",
  "auto_fix": { "complexity": "complex" }
}
```

Fetches the homepage HTML and asserts the inline Capacitor detection script
is present (it contains the literal string `data-native`). If someone removes
the inline `<head>` script from `app/layout.tsx`, the cron will flag the
regression in the next morning recap. Auto-fix marked **complex** because
re-adding the script also requires the matching CSS + bridge changes — a
human needs to verify all three layers.
