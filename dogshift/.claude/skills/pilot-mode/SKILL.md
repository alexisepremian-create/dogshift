---
name: pilot-mode
description: Manage DogShift's pilot mode — invite-code gating for sitter signup, maintenance mode toggle, platform lock-on. Use when modifying invite flow, debugging "can't access /become-sitter/form", or toggling maintenance from admin.
---

# Pilot mode — DogShift

## Why pilot mode exists

DogShift is in **pilot phase** (~16 active users, Romandie only). Signup is gated to keep onboarding controlled. Two parallel gates :

1. **Invite codes** for sitter signup (`/become-sitter/form`)
2. **Maintenance mode** for the whole platform (flippable from admin, no redeploy)
3. **Site lock** (legacy, for staging-style password walls)

Exit conditions for pilot mode :
- ~50+ active sitters across Romandie cantons
- Stable booking flow + payout cycle (3 months without payout incidents)
- Decision to remove gating (separate PR, see `pilot-mode` section in CLAUDE.md when reverted)

## Invite-cookie gate

`/become-sitter/form` and `POST /api/become-sitter/apply` require the `ds_invite_unlocked=1` cookie (or legacy `ds_invite=1`).

The cookie is set after `POST /api/invites/verify` with a valid code.

**NOT** a URL param. Invites are per-browser, revocable.

```
proxy.ts logic:
- /become-sitter/form requested
  → check cookie ds_invite_unlocked=1
  → if absent → redirect /become-sitter (the public landing)
  → if present → allow
```

The `PILOT_ADMIN_CODE` env var is the master "pilot password" — admin UI uses it to grant new invites.

## Maintenance mode

`PlatformSettings` is a Prisma singleton (`id = "global"`). Toggle via :

```
PATCH /api/admin/platform-settings
{ "maintenanceMode": true, "maintenanceMessage": "Maintenance en cours, retour à 18h" }
```

The flag is **live-flippable** (no redeploy). Public clients read it via :

```
GET /api/platform/status
{ "maintenanceMode": false, "maintenanceMessage": null }
```

The UI shows a banner when maintenanceMode is on. When toggling :

- **Always set `maintenanceMessage`** — generic banner is uninformative
- **Don't leave it on forever** — owners can't book, sitters can't manage availability

This is the **ONLY** way to gate the whole platform without a deploy. Don't bolt on alternative kill switches.

## Site lock (legacy)

`x-site-password-set` + `x-site-lock-on` response headers. Used historically for password-walled staging. Currently inactive on prod but the plumbing exists in `proxy.ts`.

Don't add new features that rely on this — it's deprecated. Use maintenance mode instead.

## What the gate covers

| Resource | Gated by |
|---|---|
| `/become-sitter/form` | invite cookie |
| `POST /api/become-sitter/apply` | invite cookie |
| Whole platform | `maintenanceMode` |
| Specific URLs (rare) | site-lock headers |

Other routes are open : owner signup is NOT gated (only sitters are pilot-controlled).

## Admin pilot UI

`/admin/dashboard` shows the current pilot status + a button to set/refresh `PILOT_ADMIN_CODE`. Same panel toggles `maintenanceMode`.

`/admin/sitter-applications` → admin issues invites by emailing the code to specific candidates.

## When debugging "can't access /become-sitter/form"

1. **Cookie present** ? DevTools → Application → Cookies → look for `ds_invite_unlocked` (value `1`)
2. **Cookie expired** ? Re-verify with the invite code
3. **Wrong code** ? `/api/invites/verify` returns `{ ok: false, error: "INVALID_CODE" }` — check the code matches `PILOT_ADMIN_CODE` env
4. **Pilot disabled** ? Check `PILOT_MODE` env on Vercel. If unset, the gate is effectively off (legacy)

## When exiting pilot mode

This is a coordinated change, NOT casual :

1. Decide the exit criteria are met (founder call)
2. Remove the cookie gate from `proxy.ts` (`/become-sitter/form` no longer protected)
3. Remove the verify step from `/become-sitter` landing
4. Drop `PILOT_MODE` + `PILOT_ADMIN_CODE` env vars from Vercel
5. Drop the `Invite*` Prisma models (or keep them dormant)
6. Update CLAUDE.md to remove the pilot mode section
7. Announce on social + Telegram news bot

Until then, **NEVER loosen the gate** (e.g. "add a query-param escape hatch for testing") — that would void the security model.

## What NOT to do

- ❌ Loosen the gate "just for testing" — adds attack surface
- ❌ Hardcode the invite code in client-side JS — exposed to anyone
- ❌ Use `maintenanceMode` for partial outages (a single failing route) — it gates the WHOLE platform
- ❌ Leave `maintenanceMessage` empty when toggling on
- ❌ Roll your own kill switch — the platform settings is the only path
- ❌ Confuse `PILOT_MODE` env with `maintenanceMode` DB flag — they're orthogonal

## Where to look

- `proxy.ts` — middleware gates
- `app/api/invites/verify/route.ts` — invite verification
- `app/api/admin/platform-settings/route.ts` — maintenance toggle
- `app/api/platform/status/route.ts` — public status read
- `prisma/schema.prisma` → `PlatformSettings`, `InviteCode`, `PilotSitterApplication`
- `CLAUDE.md` §"Pilot mode & invite gating"

## Env vars

```bash
PILOT_MODE=true                    # toggle the whole gate
PILOT_ADMIN_CODE=                  # the master password for issuing invites
ADMIN_EMAILS=                      # whitelist for admin UI
HOST_ADMIN_CODE=                   # admin gate cookie
```
