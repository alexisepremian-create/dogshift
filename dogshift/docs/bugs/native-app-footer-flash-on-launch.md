# Native app cold launch shows footer instead of the homepage

**Status:** Fixed 2026-06-05 (initial fix + follow-up). First production occurrence reported by the
founder while testing the Capacitor iOS build in the Xcode simulator.
**Severity:** Visual / brand only — no data corruption. But it's the very
first impression on app launch, so it counts as a P1.

> **History note (2026-06-05):** the first fix (PR #430) used a CSS overlay
> on `<html>::before` to mask the SSR layout during hydration. It worked
> functionally but introduced ugly **white safe-area bands** at the top
> (status bar zone) and bottom (home indicator zone) of the screen,
> because CSS pseudo-elements on `<html>` only paint within the WebView's
> viewport — not into the iOS safe-area zones where the WebView's
> `backgroundColor` (white) shows through. Follow-up PR replaced the CSS
> overlay with an **extended native iOS LaunchScreen**: same purple
> background and the inverted-white DogShift logo, but rendered by iOS
> outside the WebView so it covers the FULL screen including safe-areas.
> Keep this history — the CSS overlay is a tempting "lighter" approach
> and we don't want to relearn this.

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

## Fix (current stable form)

Six coordinated layers. The cold launch unfolds in two visual phases
that look identical at the seam (native splash → CSS overlay) and a
final grow-and-fade animation that reveals NativeMapHome.

1. **Native iOS LaunchScreen** (`capacitor.config.ts → SplashScreen.launchShowDuration = 30000`,
   was 1500 ms). The storyboard's `Splash` imageset is now a 2732×2732
   PNG: DogShift purple `#7c3aed` background, white paw silhouette
   centred (extracted from `public/apple-touch-icon.png` via
   `scripts/generate-native-splash.mjs` — luminance smoothstep so the
   silhouette has clean anti-aliased edges and no purple-card outline).
   iOS renders the LaunchScreen OUTSIDE the WebView so it covers the
   entire screen including the status-bar and home-indicator safe-area
   zones. `launchAutoHide` stays `true` as a safety net (catastrophic
   JS failure case — see "What NOT to do" below).

2. **CSS in-WebView overlay** (`app/globals.css → html[data-native]::before` +
   `html[data-native]::after`). Same purple, same paw (sourced from
   `public/dogshift-paw-white.png`, also produced by the script — so
   the artwork between native and CSS is byte-for-byte the same), same
   position (centred, 43vmin wide). Painted by the WebView before the
   bridge gets here. When `SplashScreen.hide()` drops the native
   splash, the WebView is already showing identical pixels — zero
   visual seam.

3. **`viewport-fit=cover`** (`app/layout.tsx → viewport.viewportFit`).
   Lets the HTML viewport (and therefore the CSS overlay) paint into
   the iOS status-bar and home-indicator safe-area zones. Without it,
   the `::before` pseudo-element is bounded by the safe-area-respecting
   viewport and we get the same ugly white bands as the initial PR #430
   attempt. Safe to set globally because every UI surface in this app
   that touches a screen edge already uses `env(safe-area-inset-*)`.

4. **Bridge orchestrates the handoff** (`lib/native/capacitorBridge.ts`).
   On init: (a) `await SplashScreen.hide()` — native splash drops, CSS
   overlay underneath is revealed and looks identical; (b) sleep
   `SPLASH_REACT_MOUNT_BUFFER_MS` (500 ms) so React has time to commit
   `<NativeMapHome>` (or whatever native-variant page the user landed
   on) — without this the overlay fade can race the React commit and
   briefly expose the marketing layout's white body in the iOS
   safe-area zones; (c) set `data-native-ready` on `<html>`, triggering
   the keyframe animation `ds-native-splash-paw-grow` (paw scales 1 →
   1.6, fades over 700 ms, `cubic-bezier(.25,.1,.25,1)` for an
   Apple-like ease-out — the "grow" the founder asked for). The
   background fades on a slightly delayed ramp via
   `ds-native-splash-bg-fade`. 700 ms later the user is on
   `<NativeMapHome>`.

5. **Inline `<head>` script** (`app/layout.tsx`). Capacitor injects
   `window.Capacitor` at `documentStart`, so a synchronous script in
   `<head>` can call `isNativePlatform()` BEFORE the first paint. It
   sets `data-native="true"` on `<html>` (and mirrors to `<body>` via
   RAF once it exists). This is what gates layers #2 and #6 — without
   it the overlay never paints and the footer flash returns.

6. **Marketing-footer hide rule** (`app/globals.css → html[data-native] footer { display: none !important }`).
   Belt-and-suspenders. Even if the CSS overlay logic breaks for any
   reason, the footer never reaches the user in native mode. The
   footer is also wrapped in `<WebOnly>` in
   `app/(marketing)/layout.tsx` for the post-hydration state.

7. **Body-bg fallback in native mode**
   (`app/globals.css → html[data-native] body { background-color: #7c3aed }`).
   Pure safety net. If anything ever goes wrong — buffer too short,
   React hung mid-commit, overlay z-index regression — the body's
   background paints brand purple in native mode, so the worst case
   is the user sees a slightly-too-purple screen for a moment. Never
   a white band. The various per-page outer wrappers (NativeMapHome
   `bg-slate-100`, dashboards' own backgrounds) cover this rule the
   moment they mount, so it's only visible during the cold-launch
   window.

## How to recognize a regression

- Launch the Capacitor iOS app from the home screen (or via Xcode →
  Run). The native iOS splash (purple + white DogShift logo) should
  cover the entire screen — including the status bar zone at the top
  and the home indicator zone at the bottom — with NO white bands at
  the edges. The splash should transition directly to NativeMapHome,
  never to a screen showing the marketing footer with "DogShift / La
  plateforme de confiance / Produit / Légal / Contact" sections.
- If you see white bands at top/bottom during the splash, the splash
  image was regenerated incorrectly or the WebView's `backgroundColor`
  is showing through — check `ios/App/App/Assets.xcassets/Splash.imageset/`
  and rerun `node scripts/generate-native-splash.mjs`.
- If the splash stays up for 30 seconds and then drops to the marketing
  layout, the bridge's `SplashScreen.hide()` call failed — check the
  Safari Web Inspector console for `[native]` warnings.
- Public web (`dogshift.ch` in a desktop browser) MUST behave exactly
  as before — no purple, no hidden footer, no extra HTML.

## What NOT to do when fixing it again

- **Do NOT remove `viewportFit: "cover"` from `app/layout.tsx`.** The
  `html[data-native]::before` overlay only paints into the iOS safe-
  area zones thanks to that viewport setting. Without it the overlay
  is bounded by the safe-area-respecting viewport and you get the
  white bands at top (status bar) and bottom (home indicator). This
  was the exact regression that PR #430 shipped before being patched
  by PR #431.
- **Do NOT change the paw artwork in only ONE place.** The PNG used
  by the iOS LaunchScreen and the one served at
  `/dogshift-paw-white.png` for the CSS overlay are BOTH produced by
  `scripts/generate-native-splash.mjs`. If you regenerate one without
  the other, the splash → app transition will pop at the seam because
  the artwork is no longer byte-identical. Always rerun the full
  script.
- **Do NOT shorten `launchShowDuration` back to the default 3000 ms or
  the previous 1500 ms.** The Neon cold start + React hydration window
  can easily exceed 5 s on first launch. 30 s is the safety net for
  the bridge-init-failed case; in the happy path the bridge calls
  `SplashScreen.hide()` in 1-3 s so the user never waits anywhere near
  the 30 s ceiling.
- **Do NOT set `launchAutoHide: false`.** If the Capacitor JS bridge
  ever fails to load (offline, breaking JS error before
  `useNativeBridge()` mounts), the splash would stay up forever and
  the user is stuck on a frozen screen. The 30 s auto-hide is the
  escape hatch — the user then sees the SSR-streamed marketing layout
  which is broken UX but at least interactive.
- **Do NOT rely solely on `useIsNativeApp()` / `<WebOnly>` to hide
  native-incompatible UI on cold launch.** Both fire post-hydration,
  which is too late by 200 ms-5 s on cold Neon connections.
- **Do NOT remove the inline `<head>` script** from `app/layout.tsx`
  even if it looks "redundant" with `useIsNativeApp()`. The two work
  together: the script covers the pre-hydration window (sets
  `data-native` on `<html>` synchronously so the footer-hide CSS rule
  applies from the first SSR paint), the hook covers the
  post-hydration state.
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
so we shipped the native-splash fix first.

## Related PRs

- PR #430 (2026-06-05) — initial fix using inline head script + CSS
  overlay + `data-native-ready` flag on the bridge. Introduced the
  white safe-area bands regression.
- PR #431 (2026-06-05) — replaced the CSS overlay with an extended
  native iOS LaunchScreen so the safe-area zones were also covered.
  Lost the in-WebView splash; founder fed back that the cut to
  NativeMapHome felt abrupt and the paw should grow on launch.
- PR #432 (2026-06-05) — added back the in-WebView CSS overlay with
  matching paw artwork from `apple-touch-icon.png`, set
  `viewport-fit=cover` so the overlay covers safe-areas, added the
  scale-up grow animation triggered after a RAF. The animation worked
  but exposed an ugly safe-area band regression in the rare case
  where React hadn't yet committed `<NativeMapHome>` by the time the
  overlay's bg fade started.
- PR #433 (2026-06-05) — fixed the bg-fade race. Added
  `SPLASH_REACT_MOUNT_BUFFER_MS = 500` between `SplashScreen.hide()`
  and the `data-native-ready` flip in `capacitorBridge.ts` so React
  has time to mount the active page's native variant before the
  overlay fades. Added a body background fallback
  (`html[data-native] body { background-color: #7c3aed }`).
- This PR (2026-06-05) — **the bands kept coming back during the
  animation despite the body bg fallback.** Root cause: the WebView's
  *own* background (`ios.backgroundColor` / `android.backgroundColor`
  in `capacitor.config.ts`) was set to `#ffffff`. The body bg only
  paints inside the body's layout box; the iOS safe-area zones
  outside it show the WebView's bg directly. **Fixed by painting the
  WebView purple too** (`ios.backgroundColor: "#7c3aed"`,
  `android.backgroundColor: "#7c3aed"`) and switching the StatusBar
  to `style: "LIGHT"` + `backgroundColor: "#7c3aed"` (config + bridge
  runtime call). Now every layer the user could possibly see during
  the splash → app transition is brand purple — native LaunchScreen,
  WebView, body bg, CSS overlay, status-bar bg. **No white band can
  exist by construction.** Pages that need a white bg (login,
  dashboards) paint over the body purple inside their own layout box,
  exactly as before — only the safe-area zones differ visually.

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
