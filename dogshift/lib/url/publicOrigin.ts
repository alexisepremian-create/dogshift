/**
 * Absolute app URL for OAuth / sign-out redirects. Clerk rejects or mishandles
 * relative redirect URLs on custom domains (authorization_invalid on callback).
 */
export function resolvePublicOrigin(): string {
  if (typeof window !== "undefined" && typeof window.location?.origin === "string") {
    return window.location.origin.replace(/\/$/, "");
  }
  return (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
}

/** Prefix a path (e.g. `/auth/google`) with the public origin; pass through full URLs. */
export function withPublicOrigin(pathOrUrl: string): string {
  const p = (pathOrUrl || "").trim();
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  const origin = resolvePublicOrigin();
  if (!origin) return p;
  return `${origin}${p.startsWith("/") ? p : `/${p}`}`;
}

/**
 * Origin for full-page navigations right after OAuth / post-login.
 * On production dogshift, `NEXT_PUBLIC_APP_URL` (typically https://www.dogshift.ch) avoids
 * landing on apex while Clerk cookies were issued for www (or vice versa).
 */
export function navigationPublicOrigin(): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (typeof window === "undefined") return env;

  let loc = "";
  try {
    loc = window.location.origin.replace(/\/$/, "");
  } catch {
    return env;
  }

  let host = "";
  try {
    host = new URL(loc).hostname.toLowerCase();
  } catch {
    return loc || env;
  }

  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    return loc;
  }

  if (env && (host === "dogshift.ch" || host === "www.dogshift.ch")) {
    return env;
  }

  return loc || env;
}
