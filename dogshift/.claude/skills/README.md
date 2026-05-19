# Claude skills installed on DogShift

21 skills committed in `.claude/skills/`. Auto-activate based on `description` front-matter when the conversation context matches — no explicit invocation needed.

To force-activate : `"Utilise la skill <name>"`.

## DogShift custom (9)

Encoded from real DogShift incidents + conventions. Source of truth = this repo.

| Skill | Activates on |
|---|---|
| `debug-runtime` | 5xx in prod, silent fail, "ça marche pas" |
| `migration-prisma` | PrismaClient errors, schema drift, after schema.prisma changes |
| `ship-pr` | "ship", "push", "PR", post-modif |
| `telegram-format` | New sendTelegramMessage, bot refactor |
| `stripe-payout` | Sitter payout debug, lib/stripe/ changes |
| `cron-write` | New /api/cron/ route |
| `agent-write` | New cron/webhook/hybrid agent |
| `e2e-playwright` | tests/e2e/ changes, CI smoke failure |
| `r2-upload` | Presign/commit endpoint, upload debug |

## UI UX Pro Max suite (7)

Source : [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT). Design intelligence for marketing pages + sitter UI. 67 UI styles, 161 color palettes, 57 font pairings, accessibility checks.

| Skill | Use |
|---|---|
| `ui-ux-pro-max` | Main orchestrator — design system generator |
| `design` | General design principles |
| `design-system` | Build a coherent design system |
| `ui-styling` | Component-level CSS / Tailwind decisions |
| `brand` | Brand identity (colors, typography, tone) |
| `banner-design` | Marketing banners + social previews |
| `slides` | Slide decks / presentations |

## Stop-slop (1)

Source : [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) (MIT). Strips AI-slop patterns (filler phrases, "Here's the thing", binary contrasts, passive voice). Use for emails, marketing copy, Telegram bot messages, release notes.

## Remotion video (1)

Source : [wshuyi/remotion-video-skill](https://github.com/wshuyi/remotion-video-skill). Programmatic videos via Remotion framework. Use for social media content, sitter tutorials, marketing reels.

## Context engineering (3)

Source : [NeoLabHQ/context-engineering-kit](https://github.com/NeoLabHQ/context-engineering-kit) (GPL v3 — internal use only, not redistributable in proprietary form).

| Skill | Use |
|---|---|
| `reflect` | Self-critique a previous response, iterative refinement |
| `review-pr` | Comprehensive PR review with specialized lens |
| `root-cause-tracing` | Trace bugs backward through the call stack |

## License compliance

- MIT skills (UI UX Pro Max, Stop Slop) : free use + redistribution
- GPL v3 skills (context-engineering-kit) : kept for internal Claude Code use only. NOT redistributed (DogShift source stays closed). Skill instructions are arguably not "software" in the GPL sense (they're prompts), but treating them conservatively.
- Unlicensed (remotion-video) : implicit grant of use per author's distribution intent (npx-installable)

All community skills retain their original attribution. To remove any, delete the folder + this README entry.

## What about the brain index ?

`brain/🤖 Agents/Skills/Skills.md` (gitignored) maintains a one-liner per skill for Obsidian browsability. Mirrors this README.
