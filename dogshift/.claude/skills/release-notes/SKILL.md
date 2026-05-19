---
name: release-notes
description: Generate French changelog from git log + post a release notes summary on the news Telegram bot. Use when user asks for a recap of what shipped, a release announcement, or wants to publish DogShift updates.
---

# Release notes — DogShift

## Goal

Turn `git log` into a clean, French, human-readable release recap. Optionally publish to the news Telegram bot.

## Format

Markdown or HTML (HTML if Telegram-bound). Sections by type :

```
🚀 <b>DogShift — Récap des nouveautés (19 mai 2026)</b>

✨ <b>Nouvelles fonctionnalités</b>
• Récap groupé Telegram pour les nudges sitter onboarding (#384)
• Détection auto des migrations Prisma manquées (#386)

🐛 <b>Corrections</b>
• Page candidatures admin (`/admin/sitters/applications`) qui plantait en 500 (#386)
• Logout qui revenait au dashboard (#360)

⚙️ <b>Améliorations techniques</b>
• Format unifié pour les 6 bots Telegram (#378)
• Diagnostic structuré des erreurs Prisma (#385)

<i>Généré automatiquement · 19 mai 2026</i>
```

## Workflow

### 1. Collect commits since the last release

```bash
# Most recent tagged release → HEAD
git log v<previous>..HEAD --oneline --no-merges

# Or by date if no tags
git log --since="7 days ago" --oneline --no-merges
```

### 2. Classify by Conventional Commits prefix

| Prefix | Section |
|---|---|
| `feat:` | ✨ Nouvelles fonctionnalités |
| `fix:` | 🐛 Corrections |
| `perf:` | ⚡ Performance |
| `refactor:` / `chore:` | ⚙️ Améliorations techniques |
| `docs:` | 📝 Documentation (optionally drop) |
| `test:` | (drop — internal only) |

### 3. Translate to French + summarize

Each commit subject is already concise but in English. Translate to FR, drop the type prefix and scope, keep the gist, add the PR number.

**English** → **French** :
- "wire 4 sitter-side crons to the relances bot" → "Récap Telegram quand on relance un sitter"
- "log structured Prisma error in pilot-sitter-applications GET" → "Diagnostic plus précis des erreurs DB côté admin"

Keep it concrete and user-facing. Skip internal stuff (CI tweaks, dependency bumps, doc-only changes) unless the user explicitly asks for the full thing.

### 4. Render with telegram-format helpers

```ts
import { tgHeader, tgSection, tgFooter, formatDateFR } from "@/lib/telegram/format";

const now = new Date();
const message = [
  tgHeader("🚀", "DogShift — Récap des nouveautés", now),
  "",
  tgSection("✨", "Nouvelles fonctionnalités"),
  "• …",
  "",
  tgSection("🐛", "Corrections"),
  "• …",
  "",
  tgFooter(now),
].join("\n");
```

### 5. Post to news bot (optional)

```ts
await sendTelegramMessage(message, { bot: "news", parseMode: "HTML" });
```

The `news` bot is meant for veille canine, but it's the closest existing channel for "DogShift updates". If volume grows, consider creating a dedicated `releases` bot later.

## Cadence options

- **Weekly** (recommended) — every Monday morning, recap last 7 days
- **On-demand** — user says "fais un recap"
- **Per-release** — when tagging a version (DogShift doesn't tag yet — semantic versioning is overkill for pilot phase)

## What NOT to do

- ❌ Translate commit messages literally → boring, not user-facing
- ❌ Include internal commits (CI, deps bumps, brain/ chores) in user-facing recap
- ❌ Skip the PR number — it's the anchor for "I want to know more"
- ❌ Mix branches : always use `main` for what shipped to prod
- ❌ Forget to drop reverted commits (look for `revert:` prefix)
- ❌ Publish without showing the founder first (releases are public-facing)

## Quick local recipe

```bash
# This week's main commits, formatted
git log --since="7 days ago" --no-merges --pretty=format:"%h %s" main | grep -vE "(^[a-f0-9]+ chore|test|ci|docs):"

# Just the PR numbers from last week
git log --since="7 days ago" --no-merges --pretty=format:"%s" main | grep -oE '#[0-9]+'
```

## Linking to the right URLs

- PR : `https://github.com/alexisepremian-create/dogshift/pull/<num>`
- Commit : `https://github.com/alexisepremian-create/dogshift/commit/<sha>`
- Use HTML anchor : `<a href="...">#387</a>`

## Where to look

- `lib/telegram/format.ts` — helpers (same as for other Telegram messages)
- `brain/🤖 Agents/Telegram bots/Bot news.md` — current news bot fiche
- Existing commits for style reference : `git log main --oneline -20`
- Existing PR titles : `gh pr list --state merged --limit 20`
