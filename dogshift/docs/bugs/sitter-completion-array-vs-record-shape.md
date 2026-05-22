# Sitter completion calculated as wrong % when `services` is stored as array

**Status:** Fixed (PR #399, May 22 2026)

## Symptom

Sitter Sysy Montreux complained that she had filled in her profile but kept
receiving onboarding nudge emails saying her profile was incomplete. The
email displayed a `%` that did not match what her dashboard showed.

Same root cause reproduced on dev for Matilda Ritter : her dashboard
displayed a completion percentage, but the cron-side calculation got a
different (lower) value for the **same person** at the **same instant**.
The `pricing` check was falsely flagged as missing even though her pricing
was correctly set.

## Root cause

DogShift stores a sitter's profile in two places (intentionally — see
`docs/data-models.md`) :

1. **`User.hostProfileJson`** — JSON blob, used by the dashboard
   `/host/profile/edit`. `services` is serialized as a **boolean record**:
   ```json
   { "Promenade": true, "Garde": true, "Pension": false }
   ```

2. **`SitterProfile.services`** — Prisma `Json` column, used by the cron
   `sitter-onboarding-nudge` and other server-side readers. `services` is
   serialized as an **array of enabled names** :
   ```json
   ["Promenade", "Garde"]
   ```

The POST handler `/api/host/profile` does this normalization on write
(line 334) — `enabledServices = Object.keys(servicesObj).filter(...)` —
then writes the array to the column while keeping the original record in
the JSON blob.

`computeSitterProfileCompletionDetails` in `lib/sitterCompletion.ts` only
understood the boolean-record shape. When called with the array shape :

```ts
const svcRecord = toRecord(p.services);            // arrays are objects → passes through
const enabledServices = Object.keys(svcRecord)     // ["0", "1"] (numeric indices!)
  .filter((k) => Boolean(svcRecord[k]));           // both truthy strings → passes

const pricingRecord = toRecord(p.pricing);         // { Promenade: 20, Garde: 26 }
const pricing = enabledServices.every(             // every check pricingRecord["0"], pricingRecord["1"]
  (svc) => typeof pricingRecord[svc] === "number"  // undefined → false
);
// → pricing falsely flagged as missing
```

So the function reported "pricing not filled in" for **every** sitter
whose row was read by the cron, dropping their completion from 100% to
~88% and triggering the "complete your profile" nudge email. The
dashboard, reading the boolean-record shape, computed the correct value
and the user saw the mismatch.

Same issue affected `dogSizes` which is stored as an array of enabled
names in the same column-style storage.

## Fix

Added a `normalizeServiceFlags()` helper in `lib/sitterCompletion.ts` that
canonicalizes both shapes (and tolerates `null`, garbage values, etc.)
before the check loop runs :

```ts
function normalizeServiceFlags(v: unknown): Record<string, boolean> {
  if (Array.isArray(v)) {
    const out: Record<string, boolean> = {};
    for (const k of v) {
      if (typeof k === "string" && k.trim()) out[k.trim()] = true;
    }
    return out;
  }
  if (v && typeof v === "object") {
    const out: Record<string, boolean> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = Boolean(val);
    }
    return out;
  }
  return {};
}
```

Both `services` and `dogSizes` are normalized through this helper. No
behaviour change for callers already using the boolean-record shape.

## Diagnostic CLI

Shipped in the same PR : `scripts/debug-sitter-completion.ts`.

```bash
npx tsx --env-file=.env.local scripts/debug-sitter-completion.ts <email>
```

It prints the two source-of-truth snapshots side-by-side and highlights
which of the 8 completion checks diverge between
`User.hostProfileJson` and `SitterProfile.*`. Exit 0 when aligned, exit 1
when a divergence is detected. Used to surface this very bug on Matilda's
row in dev.

## How to recognize a regression

- Sitter complains "j'ai rempli mon profil mais je reçois encore des
  emails" while the dashboard shows 100% and the email says < 100%.
- The diagnostic CLI flags a divergence on `pricing` and/or `dogSizes`
  for the affected sitter.
- The Telegram recap of `sitter-onboarding-nudge` includes sitters whose
  `SitterProfile.profileCompletion` column is at 100 (last write) but
  the cron's recomputed value is lower.

## What NOT to do

- ❌ Don't "fix" the divergence by changing the column write format
  silently — there may be other readers (legacy admin tools,
  `scripts/brain/export-sitters.ts`) that depend on the array shape.
  Normalize at the **read** side instead, where the fix is local.
- ❌ Don't drop the stored `SitterProfile.profileCompletion` column —
  it's used as a fast cache in admin lists. Keep it, just don't trust
  it as the only source.
- ❌ Don't add a second `if (Array.isArray(services))` branch inline in
  the check function — the helper is the only safe place to centralize
  the shape tolerance.

## Layer 2 / Layer 3 follow-ups (not in PR #399)

- **Layer 2** : `POST /api/host/profile` should write `services` and
  `dogSizes` in the **same shape** in both `User.hostProfileJson` and
  `SitterProfile.*`. Pick one canonical shape (record is easier to
  introspect, array is more compact). This eliminates the divergence at
  the source for new saves but doesn't help legacy rows.
- **Layer 3** : admin debug route `/api/admin/debug/sitter-completion?email=...`
  exposing the diagnostic CLI's output via HTTP, plus a daily cron
  `completion-sync-check` that scans every activated sitter and pings the
  maintenance Telegram bot if any divergence is detected.

## Related

- `lib/sitterCompletion.ts` — the function with the new helper
- `lib/sitterOnboardingNudge.ts` — caller from the cron
- `app/api/cron/sitter-onboarding-nudge/route.ts` — the cron itself
- `app/api/host/profile/route.ts` — writes both storage locations (POST)
  and merges them on read (GET)
- `docs/bugs/onboarding-nudge-stripe-only.md` — related "false-positive
  nudge" pattern (different cause: Stripe Connect treated like a profile
  field instead of a separate external step)

## 🤖 Automated detection

```json
{
  "type": "sql",
  "query": "SELECT COUNT(*)::int AS value FROM \"SitterProfile\" sp WHERE sp.\"lifecycleStatus\" = 'activated' AND sp.\"published\" = false AND sp.\"profileCompletion\" >= 100",
  "expect_max": 0,
  "auto_fix": { "complexity": "none" }
}
```

The detection flags any activated sitter whose stored `profileCompletion`
says 100% but who is still unpublished — that's the visible signature of
the bug (or of a sitter who hasn't toggled the publish switch, which is
also worth surfacing). The maintenance Telegram recap pulls this count
nightly via the bug-regression-check cron at 02:07 UTC.
