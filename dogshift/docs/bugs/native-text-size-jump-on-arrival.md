# Native: list + search text "jumps bigger" on arrival (requests screen)

**Status:** Fixed (June 2026)

## Symptom

In the Capacitor iOS app, landing on the **Réservations** (host requests) screen,
the text in the list rows and the search field visibly grew a beat after the
screen appeared — like a "texture bug" where the type briefly renders small then
inflates. Founder: *"le texte dans la liste et la barre de recherche devient plus
gros, ça doit rester normal"*.

## Root cause

The native typography rules in `app/globals.css` were scoped to
`body[data-native="true"]`:

1. `-webkit-text-size-adjust: 100%` / `text-size-adjust: 100%` — disables
   WebKit's **automatic text inflation** ("font boosting"), which otherwise
   enlarges the font-size of text inside tall blocks (list rows) after layout.
2. `input/textarea/select { font-size: 16px }` — the iOS no-zoom threshold.

The `data-native` attribute on **`<body>`** is added **asynchronously** by the
`useIsNativeApp` effect (one frame after mount). The attribute on **`<html>`** is
stamped **synchronously** by the boot script in `app/layout.tsx`, before first
paint. So for the first frame after the requests screen painted, neither rule was
in effect: WebKit boosted the list/field text and the field defaulted to its
`text-sm` (14px) class — then the effect ran, `body[data-native]` appeared, and
both rules snapped the text to its final size. That snap is the visible "jump".

## Fix

Anchor both rules to `html[data-native="true"]` (the synchronous boot attribute)
so they apply on the very first layout — no inflation, no 14→16px flip:

```css
html[data-native="true"] { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
html[data-native="true"] input:not([type="checkbox"]):not([type="radio"]),
html[data-native="true"] textarea,
html[data-native="true"] select { font-size: 16px; }
```

Verified via Playwright: with `data-native` on `<html>`, computed
`text-size-adjust` is `100%` and inputs/selects are `16px` from first paint.

## What NOT to do again

- Don't scope **first-paint-critical** native styling (typography size,
  text-size-adjust, anything that changes layout) to `body[data-native]`. Use
  `html[data-native]` — `body[data-native]` is set a frame late by
  `useIsNativeApp` and causes a visible flash/jump.
- Non-visual `body[data-native]` rules (tap-highlight, overscroll, touch-callout)
  are fine to keep on body — they don't change the rendered size, so the async
  delay is invisible.

## Follow-up (still grew after the first fix)

The first fix killed the autosizing + the input's own 14→16 flip, but the text
still "grew" on the Réservations tab for two more reasons, fixed in a follow-up:

1. **Wrong skeleton.** `app/(protected)/host/requests/loading.tsx` (and messages)
   rendered the **generic** `DashboardSkeleton` — the most-specific loading
   boundary wins over the faithful group fallback. Switched them to
   `NativeRouteFallback` so the tab shows the faithful `RequestsRouteSkeleton`.
2. **Skeleton/real size mismatch.** `RequestsRouteSkeleton`'s Tous/Rechercher
   placeholders were `text-sm` (14px) `<div>`s, but the real page's
   `<select>`/`<input>` are forced to **16px** by the native no-zoom rule → the
   text jumped 14→16px on every skeleton→page hand-off. Set the placeholders to
   `text-base` (16px) so they match. Guarded by
   `tests/integrations/nativeRequestsSkeletonAndLoader.test.ts`.

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "Bug de rendu WKWebView (text auto-inflation + flip async d'attribut) — visible uniquement dans le shell Capacitor iOS, pas détectable côté serveur ni par cron. Couvert par le test de régression tests/integrations/nativeTextSizeAdjust.test.ts qui vérifie que les règles typographiques natives sont bien ancrées sur html[data-native]. Vérifier manuellement sur iPhone après toute modif des règles body[data-native]/html[data-native] dans app/globals.css."
}
```
