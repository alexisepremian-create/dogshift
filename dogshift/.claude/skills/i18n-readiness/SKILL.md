---
name: i18n-readiness
description: Plan or evaluate DogShift's path from FR-only (pilot) to multi-language. NOT for "translate this string" — DogShift is intentionally French-only right now. Use when the user discusses expansion (DE/IT cantons, EU markets) or evaluating i18n architecture trade-offs.
---

# i18n readiness — DogShift

## Current state

**DogShift is French-only by design.** Swiss market, Romandie (Vaud + Geneva + Neuchâtel + Fribourg + Jura + Valais romand). NO i18n library installed. ALL French strings are inlined at the call site — no `t("key")` indirection.

## When this skill is relevant

- User mentions expansion to DE-CH (Suisse alémanique), Tessin, France, Belgique
- Considering whether to add i18n now or defer
- Counting/auditing how much rewrite is needed
- Discussing trade-offs : ship faster (no i18n) vs future-proof (extract everything)

**Not relevant** when the user just says "translate this email" — that's a single string change, FR-only doesn't change.

## Why FR-only is a deliberate choice

1. **Pilot phase** : 16 active users. i18n is overkill optimization.
2. **Inlined strings = simpler code** : no extraction step, no JSON files, no missing-key edge cases.
3. **CLAUDE.md commits to it** : "The platform is French-only by design (Switzerland market). Switching to multilingual would be a rearchitect — acceptable cost for current simplicity."
4. **Cantons matter more than language** : DE-CH cantons would want different sitters + different Stripe Connect flows (TVA, billing), not just translated UI.

## What to audit when planning i18n

If the user asks "how big is the work to add German" :

### 1. UI strings (the biggest chunk)

```bash
# Quick count of French copy in components
grep -rE "[éèêëàâîïôûùüç]" components/ app/ --include="*.tsx" --include="*.ts" | wc -l
```

This will under-count (some FR strings have no accents) but gives an order of magnitude.

### 2. Email templates

`lib/email/templates/*.tsx` — ~10 templates, each ~50-200 lines. Each would need a DE/IT variant + sender logic to pick by user locale.

### 3. Telegram bot messages

All bot messages are in French (per `brain/🤖 Agents/Telegram bots/`). Probably stays FR even after i18n — these go to the founder, not users.

### 4. Email subject lines + system emails

`subject: "Ton compte DogShift a été activé"` etc. Same pattern as templates.

### 5. Server error messages

API responses use `error: "ERROR_CODE"` (machine-readable) + `lib/errors/apiErrorMessage.ts` maps to FR display strings. **This is the only existing i18n-like layer** — extending it to DE/IT would be the simplest part.

### 6. SEO content (sitter city pages)

`app/(marketing)/sitters/[city]/` — heavy FR content for SEO. Cities outside Romandie would need DE/IT equivalent pages.

### 7. Cal.com / Stripe / external

- Cal.com interview form : currently FR-only. Has multi-lang support but separate booking pages per language.
- Stripe Connect onboarding : Stripe handles this natively per user locale. No work on our side.
- SMS Vonage : message in FR. Same pattern as emails.

### 8. Database content

Sitter bios, profile descriptions : user-supplied FR. Either :
- Force sitters to write in multiple languages
- Auto-translate via Claude API at display time (cached)
- Or stay FR and let users translate via browser

## Architectural options when ready

### Option A : `next-intl` (recommended if going multi-lang)

- App Router native support
- File-based message catalogs (`messages/fr.json`, `messages/de.json`)
- Locale in URL path (`/de/sitters`)
- ~2-3 weeks of work to extract all strings + add the catalog files

### Option B : `next-i18next`

- Older, less aligned with App Router. Skip.

### Option C : Inline ternary on `session.locale`

- Cheap, but explodes the codebase. Don't.

### Option D : Don't translate — keep FR + auto-translate via Claude API

- Per-page Claude call on first request, cached for 24h. ~50ms latency cost.
- Translated content stored in a `Translation` Prisma model keyed by source hash.
- Pros : no extraction work. Cons : LLM cost + latency + quality dips.

**Don't pick yet.** This is a strategic call for when DogShift exits the pilot phase + has product-market fit in Romandie.

## What to suggest if user asks "should I add i18n now ?"

**Default answer : NO, not yet.**

Reasons :
1. 16 active users. Romandie market not saturated.
2. Adding i18n = ~3 weeks of work that doesn't move the needle on user growth.
3. The cleanest moment is right before launching in a new region — not before.
4. Inlined FR strings make the codebase 30% smaller / more readable.

**Reverse this answer ONLY IF** :
- A concrete launch in DE-CH / France / Tessin is on the roadmap (next 6 months)
- A specific sitter or owner has requested it AND is committed (e.g. a chain wanting to onboard 20 sitters in Zurich)
- The cost of NOT having i18n is now blocking something specific

Otherwise : push back. Document the decision in `brain/🧠 Décisions/` so it's not re-litigated.

## When the time comes — migration plan sketch

1. **Pick a library** : `next-intl` (default recommendation in 2026).
2. **Extract strings** : scripted pass to find all French copy in `components/` + `app/` + `lib/email/templates/`. Move to `messages/fr.json`.
3. **Wrap with `t()`** : replace inlined strings with `t("key")` calls. Heavy mechanical work.
4. **Add `<NextIntlClientProvider>`** at the layout root.
5. **Add `/[locale]` segment** : `app/[locale]/layout.tsx`.
6. **Translate** : `messages/de.json`, `messages/it.json`. Use Claude/DeepL for first pass, human review.
7. **Update middleware** : `proxy.ts` to detect locale + redirect.
8. **Update SEO pages** : per-language sitemap.
9. **Update emails** : `sendEmail()` picks template by `user.locale`.
10. **Update Cal.com** : separate booking page per language.

Expect 2-3 weeks of focused work. Don't break Romandie users mid-migration — feature flag `i18n_enabled` initially.

## What NOT to do

- ❌ Add i18n "just in case" — over-engineering, costs you simplicity now for hypothetical future
- ❌ Use `t("key")` inline anywhere — that requires the library, which isn't installed
- ❌ Start a partial migration ("just one component") — half-done i18n is worse than none
- ❌ Translate strings without a target market commitment
- ❌ Auto-translate user bios via LLM at write time — user authorship is sacred. Display-time translation only.

## Where to look

- `CLAUDE.md` §"i18n" — official decision record
- `lib/errors/apiErrorMessage.ts` — only existing i18n-like indirection
- `docs/structure.md` — folder map (helps quantify the audit)
- `brain/🧠 Décisions/` — for the eventual ADR when the decision is made
