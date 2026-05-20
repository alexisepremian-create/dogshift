# Mobile : "Publier mon annonce" toggle unresponsive on iOS Safari

**Status:** Fixed (PR `fix/prod-bugs-may-20`, May 20 2026)

## Symptom

On iOS Safari (and sometimes Android Chrome), the toggle to publish a sitter's
profile in `/host/profile/edit` did not respond to taps. The user could see
the toggle but tapping it never flipped the state — they could not enable the
publication of their listing from their phone.

Sitter Sylvana (verified, profile 88 % complete) couldn't toggle her
"Publication de l'annonce" switch from her phone. The annonce stayed in
`brouillon` (draft) state.

## Root cause

The toggle `<button>` had an HTML `disabled` attribute :

```tsx
<button
  type="button"
  onClick={() => { if (!canTogglePublish) return; setPublished(v => !v); }}
  disabled={!canTogglePublish}   // ← THIS
  ...
>
```

`canTogglePublish = published || canPublish` — initially `false` until the
profile reaches 100 % completion. With `disabled={true}`, iOS Safari does not
deliver touch events to the React handler. The user can never bring the
button to a state where they could toggle it ON, because the precondition
("profile 100 %") often requires Stripe Connect onboarding which they must
launch from the dashboard, not from the toggle row.

Even after the precondition becomes true, the **first tap** is sometimes
silently dropped because iOS applies a 300 ms ghost-click delay on elements
without `touch-action: manipulation`. This is the same root cause as the
older `mobile-first-touch-delay.md` fiche.

## Fix

Two changes in `app/(protected)/host/profile/edit/page.tsx` :

1. Replace HTML `disabled={!canTogglePublish}` with **`aria-disabled`** plus a
   conditional className for visual styling. The early-return inside the
   `onClick` handler keeps the guard in place.
2. Add `style={{ touchAction: "manipulation" }}` to neutralize iOS 300 ms tap
   delay.

```tsx
<button
  type="button"
  onClick={() => { if (!canTogglePublish) return; setPublished(v => !v); }}
  aria-disabled={!canTogglePublish}
  style={{ touchAction: "manipulation" }}
  className={`... ${!canTogglePublish ? "cursor-not-allowed opacity-50" : ""} ...`}
>
```

This mirrors the pattern used by the notification toggles in
`app/(marketing)/account/settings/page.tsx` which work correctly on mobile.

## How to recognize a regression

- "Le toggle Publier mon profil ne marche pas sur iPhone" / "I tap the
  publish switch on my phone but nothing happens"
- Most visible when the sitter is verified but their profile is < 100 %
  complete (i.e. they cannot publish yet but they want to see the option)
- Works fine on desktop — symptom is mobile-only

## What NOT to do

- ❌ Use the HTML `disabled` attribute on `<button>` for guard logic where
  the user must still be able to interact. Use `aria-disabled` + an early
  return inside `onClick` instead.
- ❌ Skip `touch-action: manipulation` on any new mobile-facing button. iOS
  Safari's 300 ms tap delay still bites on the first touch in a fresh session.
- ❌ Build a Capacitor native shell on top of this code without first
  verifying the toggle works in the WKWebView — the bug reproduces there
  identically.

## Related fiches

- `docs/bugs/mobile-first-touch-delay.md` — same `touch-action: manipulation`
  story, on a different surface (splash, modals, header).

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "Bug UX spécifique mobile (iOS Safari, Android Chrome) — nécessite un vrai téléphone. Pas détectable côté serveur ni par cron. Vérifier manuellement sur iPhone après chaque modif de app/(protected)/host/profile/edit/page.tsx ou de tout composant <Toggle>."
}
```
