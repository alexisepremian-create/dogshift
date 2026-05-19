---
name: cloudflare-cdn
description: Configure Cloudflare CDN for DogShift — cache headers, edge rules, WAF whitelisting, performance optimization on the homepage. Use when touching response headers, debugging cache hit rates, fixing a Cloudflare block on /api/*, or optimizing homepage Lighthouse.
---

# Cloudflare CDN — DogShift

## Stack

- **Cloudflare** sits in front of Vercel for `dogshift.ch` (proxied)
- **R2 worker** at `r2.dogshift.ch` for media URLs (avatars, contracts)
- **WAF** (Web Application Firewall) — managed rules + custom rules
- **DNS** — Cloudflare is authoritative

## Cache strategy

Cloudflare caches **static assets only** by default. Dynamic routes pass through to Vercel.

| Path | Cache | Why |
|---|---|---|
| `/_next/static/*` | Aggressive, 1 year | Versioned, immutable |
| `/api/*` | Bypass | Dynamic (auth, data) |
| `/sitters/*` (SEO pages) | Edge, ~5 min | Mostly static but content evolves |
| `/` (homepage) | Edge, ~1 min | Sitter list changes frequently |

Cache headers set in :
- `next.config.ts` (for static asset headers)
- `proxy.ts` (custom `Cache-Control` headers per route)

**Don't** add aggressive cache headers on routes that read user state — `/api/account/*` MUST stay `no-store`.

## WAF rules to be aware of

| Symptom | Cause |
|---|---|
| `/api/auth/*` returns 403 with Cloudflare HTML page | WAF blocking — add exception for the route |
| Cron route returns 401 instead of 500 | WAF + middleware fight. Check both. |
| Webhook from Stripe / Cal.com 502 | Cloudflare blocking unknown User-Agent — whitelist |

Adding a Cloudflare exception requires logging into the CF dashboard → Security → WAF → Custom rules. NOT something to do casually — always check the route auth works first.

## Vercel + Cloudflare gotchas

### IP address

Behind Cloudflare proxy, `req.ip` is the Cloudflare edge IP, not the user. Use `cf-connecting-ip` header (CF auto-adds it) to get the real user IP. The Auth.js cookie sets `AUTH_TRUST_HOST=true` for this reason.

### Cookies

Cloudflare doesn't cache responses with `Set-Cookie` by default — good, so auth flows work. If you want to cache a logged-in page, that's a deliberate decision (rare).

### Streaming / SSE

If you add a streaming route (Server-Sent Events, Anthropic streaming), CF buffers by default. Set `cache-control: no-transform` and `x-accel-buffering: no` to disable buffering.

## Performance constraints on the homepage

Strict rules (codified in `docs/PERFORMANCE.md`) :

- ❌ NO `backdrop-blur` (kills mobile Safari paint)
- ❌ NO `transition-all` (transitions everything, including expensive props)
- ❌ NO `left` / `width` animation — use `transform: translateX()` and `transform: scaleX()` instead
- ❌ NO duplicate stateful components (e.g. two `<StickySearchBar>` instances)
- ❌ NO blocking JS in critical path
- ✅ Image optimization via `next/image` ONLY (loader configured for Vercel)
- ✅ Font loading via `next/font/google` (subset to Latin, preconnect to fonts.gstatic.com)
- ✅ One critical CSS bundle inlined in `<head>`

Before touching anything in `app/(marketing)/` or `components/Sitter*` :
1. Read `docs/PERFORMANCE.md`
2. Run Lighthouse on the affected page before + after
3. Don't regress First Contentful Paint or LCP

## Image optimization

`next/image` with the Vercel loader. Two patterns :

```tsx
// Static (in /public)
<Image src="/logo.png" width={120} height={40} alt="DogShift" priority />

// Dynamic (sitter avatar)
<Image src={avatarUrl} width={64} height={64} alt={sitter.name} />
```

For R2 avatars, the URL goes through `/api/media/sitter-avatar/[token]` which generates short-lived signed URLs. CDN caches these signed URLs for the duration of the token (~10 min).

## Map performance

The homepage map (MapLibre + MapTiler) is the heaviest asset. Keep :
- `loading: "lazy"` on the parent component
- Lazy-imported via `dynamic(() => import('./Map'), { ssr: false })`
- `loader={() => fetch(... { cache: 'force-cache' })}` for tile URLs

If a sitter has no `lat`/`lng`, they don't render on the map but still appear in the list. Use the `/api/admin/geocode-sitters` endpoint to backfill geocoding.

## Cache busting

Versioned URLs (e.g. `/_next/static/<hash>/...`) update on every deploy — no need to purge. But for :
- `/api/platform/status` (maintenance mode) — `cache-control: no-cache`, must update instantly
- `r2.dogshift.ch/<key>` — purge manually via Cloudflare dashboard or `wrangler r2 object delete` when overwriting a key

**Don't** rely on `?v=<timestamp>` query params for cache busting — Cloudflare ignores query string by default unless explicitly configured.

## Debug "user reports stale content"

1. Check the response `cf-cache-status` header :
   - `HIT` — served from CF cache
   - `MISS` — origin fetched
   - `BYPASS` — cache rule excluded
   - `DYNAMIC` — not cacheable (likely cookies)
2. Check `age` header — if non-zero, content is from cache
3. Force fresh : `curl -H "Cache-Control: no-cache" https://www.dogshift.ch/...`
4. Purge if needed : Cloudflare dashboard → Caching → Configuration → Purge cache

## What NOT to do

- ❌ Cache `/api/account/*` or `/api/host/*` (user state leak)
- ❌ Add a Cloudflare Worker between users and Vercel for "perf" — Vercel handles it
- ❌ Use `<a>` instead of `next/link` for in-app nav (skips client routing, full page load)
- ❌ Add `backdrop-blur` or `transition-all` anywhere on homepage
- ❌ Trust `req.ip` — use `cf-connecting-ip`
- ❌ Set `cache-control: public, max-age=...` on routes that depend on auth

## Where to look

- `next.config.ts` — Next-level headers + image config
- `proxy.ts` — middleware headers per route
- `docs/PERFORMANCE.md` — homepage perf constraints
- Cloudflare dashboard — caching + WAF rules
- Lighthouse CI (not yet wired — candidate for future)
