// DogShift Service Worker
// Caching strategy:
//   - /_next/static/*  → CacheFirst  (immutable hashed bundles, 1 year)
//   - images/fonts     → CacheFirst  (30 days)
//   - auth/payment     → NetworkOnly (never cache)
//   - everything else  → NetworkFirst (10s timeout, 24h fallback)

const CACHE_VERSION = "ds-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const ASSETS_CACHE = `${CACHE_VERSION}-assets`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const ALL_CACHES = [STATIC_CACHE, ASSETS_CACHE, PAGES_CACHE];

// Domains that must never be served from cache
const NETWORK_ONLY_HOSTNAMES = new Set([
  "api.stripe.com",
  "js.stripe.com",
  "hooks.stripe.com",
  "checkout.stripe.com",
]);
const NETWORK_ONLY_PATTERNS = [
  /\.clerk\.com$/,
  /\.clerk\.accounts\.dev$/,
  /^clerk\./,
  /challenges\.cloudflare\.com$/,
];

function isNetworkOnly(url) {
  if (NETWORK_ONLY_HOSTNAMES.has(url.hostname)) return true;
  return NETWORK_ONLY_PATTERNS.some((re) => re.test(url.hostname));
}

function isNextStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isStaticFile(url) {
  return /\.(png|jpg|jpeg|svg|gif|webp|ico|avif|woff2?)(\?|$)/i.test(url.pathname);
}

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", () => {
  self.skipWaiting();
});

// ── Activate: purge old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("ds-") && !ALL_CACHES.includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (!url.protocol.startsWith("http")) return;

  // Auth + payment: always go to the network
  if (isNetworkOnly(url)) return;

  if (isNextStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isStaticFile(url)) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
  } else {
    event.respondWith(networkFirst(request, PAGES_CACHE));
  }
});

// ── Strategies ───────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      cache.put(request, response.clone());
      // Keep pages cache bounded to 32 entries
      trimCache(cache, 32);
    }
    return response;
  } catch {
    clearTimeout(timeout);
    const cached = await cache.match(request);
    return cached ?? Response.error();
  }
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
  }
}
