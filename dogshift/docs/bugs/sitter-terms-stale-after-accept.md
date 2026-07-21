# Publish toggle stays blocked after accepting the règlement (stale client state)

**Status:** Fixed (2026-07-21) — `HostComplianceBlockingModal` now calls `router.refresh()` after a successful acceptance.

## Symptom

A sitter on mobile (native app) opens `/host/profile/edit`, sees:

> **Votre annonce est cachée (brouillon).**
> Avant de publier ton annonce, il te reste à :
> ⚠️ Accepter le règlement DogShift

…and the publish toggle is greyed out. They **accept the règlement** in the blocking modal, the modal closes — but the checklist still says "Accepter le règlement DogShift" and the publish toggle is still greyed / **"pas cliquable"**. They're stuck, having done exactly what was asked.

Reported 2026-07-21 with a screenshot of the profile-edit publish section (no modal visible — because it had already been accepted and dismissed).

## Root cause

Client state divergence, **not** a `disabled`-button touch trap.

- `HostComplianceBlockingModal.accept()` on success only did `setAcceptedOverride(true)` — a flag **local to the modal**. That correctly hides the modal, but nothing tells the rest of the app that terms are now accepted.
- Every other consumer reads `termsAcceptedAt` / `termsVersion` from `HostUserProvider`, which is fed once by the server layout (`app/(protected)/host/layout.tsx` → `getHostUserData()`). It was never refetched.
- `/host/profile/edit` computes `const canPublish = termsOk && completionPercent >= 100 && isActivatedStatus(...)` where `termsOk = Boolean(termsAcceptedAt) && termsVersion === CURRENT_TERMS_VERSION`. With a stale `termsAcceptedAt`, `termsOk` stayed `false` → `canTogglePublish` stayed `false` → the toggle's handler early-returns (`if (!canTogglePublish) return;`), so tapping did nothing.

### Why "sur mobile" specifically

On the web a user often triggers a hard navigation / reload, which re-runs the server layout and refreshes the provider — masking the bug. The Capacitor iOS app is a long-lived remote-URL WebView that **never hard-reloads**; client-side navigations between `/host/*` pages reuse the same layout render, so the stale `termsAcceptedAt` persists for the whole session. The sitter is hard-stuck until the app is killed.

This is the same "single source on the server, multiple consumers on the client, nothing keeps them in sync" meta-cause called out in `sitter-terms-modal-missing.md` and the `sitter_completion_dual_source` note.

## Fix

`components/HostComplianceBlockingModal.tsx` — after a successful POST to `/api/host/accept-terms` (or `/accept-compliance` / `/contract-amendment/accept`), call `router.refresh()` (from `next/navigation`). This re-runs the server layout, re-reads `getHostUserData()`, and re-feeds `HostUserProvider` with the fresh `termsAcceptedAt` + `termsVersion`. `termsOk` → `true`, `canPublish`/`canTogglePublish` → `true`, the toggle becomes usable. `setAcceptedOverride(true)` is kept for instant modal dismissal.

## Regression test

`tests/integrations/sitterTermsModalGate.test.ts` — added a file-level assert that `HostComplianceBlockingModal.tsx` imports `useRouter` from `next/navigation` AND calls `router.refresh()`. If a future refactor drops the refresh, `npm test` fails before merge.

## What NOT to do again

- **Don't rely on a local `acceptedOverride` flag alone** to reflect a server-side state change. Anything that flips a persisted field (`termsAcceptedAt`, `published`, verification status) and is consumed elsewhere must `router.refresh()` (or otherwise refetch the provider) so the whole app agrees.
- **Don't chase this as a `disabled`-button/touch bug.** The publish toggle already uses the correct `aria-disabled` + early-return + `touch-action: manipulation` pattern (see `publish-toggle-mobile-disabled.md`). The tap was reaching the handler fine — the handler was correctly returning because the gate was stale.
- **Don't test only on web.** Stale-provider bugs are invisible on web (reloads hide them) and permanent in the native WebView. Verify state transitions in the app.

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "Ne se reproduit qu'au runtime pour un sitter qui accepte les CGU dans le WebView natif sans hard-reload. Le test file-level dans tests/integrations/sitterTermsModalGate.test.ts (assert que HostComplianceBlockingModal appelle router.refresh()) couvre la régression de façon déterministe à chaque CI run — plus fiable qu'une sonde HTTP qui devrait s'authentifier comme sitter aux CGU périmées."
}
```

## Historical context

- **2026-03-24 → 2026-06-01** — `sitter-terms-modal-missing.md`: the modal itself was unmounted. Fixed by re-mounting it in `HostDashboardShell`.
- **2026-07-21** — this fiche: the modal is mounted and works, but accepting didn't propagate to the publish gate. Fixed with `router.refresh()`.
