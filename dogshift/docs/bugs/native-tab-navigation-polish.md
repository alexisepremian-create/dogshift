# Native tab-navigation polish (intro gate, map gap, purple/dog flash)

> Shipped 2026-06-13. Four end-to-end native-app behaviour bugs reported on the
> iOS simulator after the running-dog redesign.

## Symptom

On the Capacitor iOS app the founder reported, all at once:

1. **"ya tjr le truc d'intro même si je suis déjà connecté"** — the onboarding /
   auth gate appeared on launch even for an already-signed-in user.
2. **"un espace énorme entre la nav barre et la carte"** — the map's collapsed
   sitter-preview sheet floated with a large empty white band above the bottom
   nav.
3. **"quand je switch entre les sections ya des fois écran violet ou chien
   animé, je veux juste que ça slide normal et fluidement comme une app pro"** —
   tab switches flashed either a full purple screen or the full-screen running
   dog instead of sliding smoothly.
4. **"les onglets réservation et msg sont toujours coupés au top"** — dashboard
   pages clipped under the status bar.

There was also a **meta-cause**: the simulator's bundled
`ios/App/App/capacitor.config.json` had been pointed at `http://localhost:3000`
during an earlier local Google-OAuth test. So the sim was loading a stale/broken
dev server — none of the merged prod fixes were ever visible ("ya rien qui a
changé"). That file is gitignored (source of truth is `capacitor.config.ts`,
which points at prod); restoring the local copy to `https://www.dogshift.ch`
fixed the "nothing changed" report.

## Root cause

1. **Intro when authed** — `NativeOnboarding` decided `shouldShow` from
   `isNative` + a localStorage flag only; it never consulted the session
   `status`, so a signed-in user still saw the gate.
2. **Map gap** — a prior fix raised the collapsed sheet height 160 → **212px**
   to stop a card being clipped, but that overshot: handle (~18px) + header
   (~36px) + one card row (~68px) ≈ 122px, leaving ~80px of empty white.
3. **Purple / dog on tab switch** — the `/host/*` and `/account/*` layouts are
   `force-dynamic`, so they `await` a DB read on every navigation. An async
   layout suspends the *layout itself*, so Next.js falls back to the nearest
   **route-GROUP** boundary, not the section's own skeleton:
   - sitter tabs (→ `/host/*`) → `app/(protected)/loading.tsx` = the running-dog
     `<PageLoader />`;
   - owner tabs (→ `/account/*`) → `app/(marketing)/loading.tsx` = `null`, which
     exposed the body background — and the native body bg was painted **purple**
     (`#7c3aed`) as a permanent splash fallback.
4. **Cut at top** — already fixed in `main` (`HostDashboardShell` /
   `OwnerDashboardShell` native `pt = safe-area-inset-top + 2rem`); only looked
   broken because the sim was on the stale localhost build.

## Fix

- `components/native/NativeOnboarding.tsx` — the gating effect now waits for the
  session to resolve and bails (`setShouldShow(false)` + `markSeen()`) when
  `status === "authenticated"`.
- `components/native/NativeMapHome.tsx` — collapsed sheet height 212 → **148px**,
  collapsed scroll `maxHeight` 170 → **86px**, and the geolocate/popup offsets
  `212px → 148px` to match.
- `app/globals.css` — added
  `html[data-native="true"][data-native-ready] body { background-color: #f1f5f9; }`
  so the body stops being purple once the splash hands off. The splash-time
  purple fallback is unchanged.
- `components/native/NativeRouteFallback.tsx` (new) + `app/(protected)/loading.tsx`
  + `app/(marketing)/loading.tsx` — the two group loaders now render a padded,
  status-bar-safe skeleton on native (instant, neutral) instead of the running
  dog (protected) or `null` (marketing). The web paths are unchanged
  (`PageLoader` for protected, `null` for marketing — keeps the e2e smoke green).

## What NOT to do again

- Don't paint the native **body** background purple permanently — only during the
  splash (`:not([data-native-ready])`). A purple body bleeds through every
  `null` loading.tsx and every force-dynamic refetch gap.
- Don't assume a section's own `loading.tsx` is the fallback shown on tab switch
  when the section's **layout** is `async`/`force-dynamic` — the GROUP-level
  loader is what fires. Make group loaders native-aware.
- Don't fix a "card clipped" bug by inflating a fixed sheet height past its
  content — size it to the content (handle + header + one row).
- When the founder says "rien n'a changé" on the sim, check
  `ios/App/App/capacitor.config.json` `server.url` first — a stale localhost
  pin makes every merged fix invisible.

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "Native-only UI/CSS behaviour (onboarding gate, sheet geometry, body-bg reset, route-group loader). Not observable from an HTTP/SQL probe; locked in by tests/integrations/nativeTabNavigationPolish.test.ts instead."
}
```
