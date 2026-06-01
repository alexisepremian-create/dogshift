# Sitter blocked at publish — "Accepter le règlement DogShift" with no toggle

**Status:** Fixed in PR `fix/sitter-terms-modal-missing` (2026-06-01) — the `HostComplianceBlockingModal` is now permanently rendered in `HostDashboardShell`, with a regression test asserting both the import and the JSX usage. **This is the second time we've shipped a fix for the exact same recurring bug** (see Mar 2026 follow-up at the bottom).

## Symptom

A sitter sees the publish-readiness panel inside `/host/profile/edit` or the dashboard. The panel says:

> ⚠️ **Avant de publier ton annonce, il te reste à :**
> ⚠️ Accepter le règlement DogShift

…with a greyed-out publish toggle. **There is no way to "accept the règlement"**: no checkbox, no button, no link, no modal. Toggling the publish switch silently fails (the backend returns HTTP 403 `TERMS_NOT_ACCEPTED` and the frontend shows the warning again). The sitter is hard-blocked.

Sonia Bürer reported this twice — once in March 2026 (initial introduction of the bug) and again on 2026-06-01 after the fix was lost during a refactor.

## Root cause

Two related causes — only fixing #1 prevents the user-facing bug, but #2 explains why this keeps regressing.

### 1. Modal not rendered (the actual bug)

The server-side gate `checkSitterSensitiveActionGate()` in `lib/sitterGuards.ts` returns `{ ok: false, status: 403, error: "TERMS_NOT_ACCEPTED" }` when either:

- `SitterProfile.termsAcceptedAt` is null, OR
- `SitterProfile.termsVersion` doesn't equal `CURRENT_TERMS_VERSION` (currently `"2026-01-15-v1"`).

The matching client-side modal that calls `POST /api/host/accept-terms` (or `/api/host/accept-compliance` for the combined case) is `components/HostComplianceBlockingModal.tsx`. It exists, works, has its own guard (returns `null` when no acceptance needed), and was previously rendered alongside `HostContractAmendmentModal` in `HostDashboardShell.tsx`.

**Commit `fef3977f7` (2026-03-24, "Keep sitter compliance flows separate from owner terms") removed the modal from the shell — and only the import line.** Two lines deleted, no replacement wired up anywhere. The acceptance endpoints and modal component stayed in the repo, fully functional, but unreachable.

```diff
- import HostComplianceBlockingModal from "@/components/HostComplianceBlockingModal";
- {!isPublicPreview && host.sitterId && <HostComplianceBlockingModal host={host} />}
```

The refactor's intent (split owner terms acceptance from sitter compliance) was legitimate — but the sitter branch was never re-attached.

### 2. Schema vs UI dual-source (the meta-cause)

This bug class keeps coming back because **terms acceptance is a single field on the server (`SitterProfile.termsAcceptedAt` + `termsVersion`) gated through one validator, but the UI affordance to set it lives in three different files** (`HostTermsModal.tsx`, `HostComplianceBlockingModal.tsx`, and the older `ContractAmendmentBlockingModal.tsx`). When someone refactors the layout shell, it's easy to "lose" one of those mounts and the breakage is invisible until a sitter tries to publish.

Same pattern as the `sitter_completion_dual_source` brain note: source of truth on one side, multiple consumers on the other, no contract test holding them in sync.

## Fix

`components/HostDashboardShell.tsx` — restore the import and render the comprehensive modal (which covers both CGU and contract amendment in one UI, calling `/api/host/accept-compliance` when both are due):

```tsx
import HostComplianceBlockingModal from "@/components/HostComplianceBlockingModal";

// inside the shell:
{isPublicPreview || !host.sitterId ? null : <HostComplianceBlockingModal host={host} />}
```

Note: we no longer render `HostContractAmendmentModal` from this shell — `HostComplianceBlockingModal` is a strict superset (it handles the amendment-only case via `/api/host/contract-amendment/accept`). Keeping both rendered would stack two modals at the same z-index when an amendment is required.

## Regression test

`tests/integrations/sitterTermsModalGate.test.ts` does two things:

1. Locks the `needsTermsAcceptance` predicate (5 scenarios covering: not a sitter, never accepted, outdated version, current version, legacy row without version).
2. **File-level assert** — reads `HostDashboardShell.tsx` as text and asserts the regex matches both the import statement AND the JSX usage `<HostComplianceBlockingModal host={host} />`. This catches the exact regression pattern of commit `fef3977f7` (someone deletes the mount line without realising the consequence).

If anyone removes the modal from the shell again, `npm test` fails before they can push.

## What NOT to do again

- **Don't delete the modal mount without immediately re-attaching it elsewhere**, even if the refactor description says "split A from B". Deleting the only place a feature is reachable is never the same as "splitting" anything.
- **Don't trust the `HostUserProvider` schema alone** — the provider exposes `termsAcceptedAt` and `termsVersion` so consuming components *can* gate behaviour, but the only place that consumes it for the blocking UX is `HostComplianceBlockingModal`. If you ever rename or restructure that component, the file-level test in this fiche will tell you immediately.
- **Don't replace the modal with an inline toggle on the profile page** without also keeping the modal — the warning message that surfaces the requirement appears in multiple places (publish toggle, dashboard banner) and only the modal can interrupt every entry point. Inline toggles invisibly miss the dashboard banner case.

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "Le bug ne se voit qu'au runtime, pour un sitter dont termsAcceptedAt est null ET qui visite /host/*. Le test de régression dans tests/integrations/sitterTermsModalGate.test.ts (assertion file-level sur le contenu de HostDashboardShell.tsx) couvre la détection de manière déterministe à chaque CI run."
}
```

We chose `type: "none"` because:
- A `type: "http"` probe would need to authenticate as a sitter without `termsAcceptedAt` set, which means seeding test data through the API — too fragile for a nightly cron.
- The regression test in `tests/integrations/sitterTermsModalGate.test.ts` runs on every PR via the existing `npm test` step in CI. If the import or JSX disappears from `HostDashboardShell.tsx`, the build fails before merge — earlier and louder than a nightly HTTP probe would catch it.

## Historical context

- **2026-01-15** — Migration `_sitter_terms_and_completion` adds `termsAcceptedAt` + `termsVersion` columns to `SitterProfile`. `HostComplianceBlockingModal` introduced and wired into `HostDashboardShell`.
- **2026-03-24, commit `fef3977f7`** — "Keep sitter compliance flows separate from owner terms" removes the modal mount from the shell. Bug introduced. No regression test catches it. Sonia reports it first time, gets a manual unblock from the admin panel.
- **2026-06-01** — Sonia reports again after vacation. We re-add the mount, add the file-level regression test, write this fiche.
