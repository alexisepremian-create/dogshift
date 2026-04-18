/**
 * Absolute app URL for OAuth / sign-out / post-login navigations.
 * Clerk and cookies must stay on one canonical host (see `navigationPublicOrigin`).
 */

/**
 * Origin for full-page navigations and OAuth absolute URLs.
 * On production dogshift, `NEXT_PUBLIC_APP_URL` (typically https://www.dogshift.ch) avoids
 * mixing apex and www (session / callback mismatches).
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

/** @deprecated Prefer navigationPublicOrigin — kept for clarity in call sites that mean "current or env". */
export function resolvePublicOrigin(): string {
  return navigationPublicOrigin();
}

/** Prefix a path (e.g. `/auth/google`) with the canonical public origin; pass through full URLs. */
export function withPublicOrigin(pathOrUrl: string): string {
  const p = (pathOrUrl || "").trim();
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  const origin = navigationPublicOrigin();
  if (!origin) return p;
  return `${origin}${p.startsWith("/") ? p : `/${p}`}`;
}
