# Search "taille" filter doesn't match a sitter's real accepted sizes

**Status:** Fixed (June 2026)

## Symptom

Filtering the sitter search by dog size ("Petit" / "Moyen" / "Grand") returned
results that didn't match what sitters actually accept in their profile — a
sitter could appear for a size they don't take, or be hidden for a size they do.

## Root cause

A sitter's accepted sizes are stored **twice** and can drift:

1. **`SitterProfile.acceptsSmall / acceptsMedium / acceptsLarge`** (Boolean
   columns, the "capacity model"). This is what the sitter toggles via
   `SizeAcceptanceToggle` and what the booking flow ENFORCES via `isSizeAccepted`
   (`lib/bookings/capacityCheck.ts`). **Source of truth.**
2. **`SitterProfile.dogSizes`** (`Json`). A legacy/derived field that can hold a
   FR-label array, a boolean record, or — from the application form
   (`lib/sitterApplication/options.ts`) — **EN codes** `["small","medium","large"]`.
   Only loosely kept in sync by `POST /api/host/profile` (the `!== false` sync at
   ~line 520).

`GET /api/sitters` returned `dogSizes: s.dogSizes ?? null` (the raw JSON), and
`SearchResultsClient` filtered on it (`parseDogSizes` → `matchesDogSize`),
**ignoring** the capacity booleans the API also returned. So search reflected the
drift-prone JSON, not reality. (By contrast the **service** filter was already
correct — resolved server-side via `resolvePublicEnabledServices`.)

## Fix

Resolve the accepted sizes **server-side from the capacity booleans** in
`/api/sitters`, mirroring how services are resolved. New helper
`lib/sitterDogSizes.ts → resolveSitterDogSizes()` derives the FR-label array from
`acceptsSmall/Medium/Large`, falling back to the legacy JSON (FR labels, EN
codes, or boolean record) only when the booleans are absent. The search filter +
sitter cards + booking now all agree.

## What NOT to do again

- Don't filter/display sitter sizes off the raw `dogSizes` JSON. Always go
  through `resolveSitterDogSizes` (booleans first).
- The application form stores EN codes; the profile uses FR labels — any code
  that reads `dogSizes` must tolerate both (the resolver does).

## Related

- `lib/sitterDogSizes.ts`, `app/api/sitters/route.ts`, `components/SearchResultsClient.tsx`
- `lib/bookings/capacityCheck.ts` (`isSizeAccepted` — the booking-side source of truth)
- Memory: "Sitter completion — dual source of truth" (same drift class for `services`/`dogSizes`).

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "Requires comparing each sitter's dogSizes JSON against the acceptsSmall/Medium/Large booleans for semantic drift — not expressible as a single SQL/HTTP probe. Covered by the unit test tests/integrations/sitterDogSizes.test.ts which locks the resolver precedence (booleans authoritative)."
}
```
