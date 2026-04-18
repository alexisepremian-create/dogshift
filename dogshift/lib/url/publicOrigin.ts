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
