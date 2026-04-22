import type { NextRequest } from "next/server";

/**
 * Resolves an absolute base URL (origin) for server-side API route handlers.
 *
 * Priority:
 *  1. `APP_URL`
 *  2. `NEXT_PUBLIC_APP_URL`
 *  3. `NEXTAUTH_URL`
 *  4. `x-forwarded-proto` + (`x-forwarded-host` || `host`)
 *
 * Returns an empty string if none of the above can be resolved.
 * Used by API routes that need to build absolute links (email CTAs, redirects, …).
 */
export function baseUrlFromRequest(req: NextRequest): string {
  const appUrl = (process.env.APP_URL || "").trim();
  if (appUrl) return appUrl.replace(/\/$/, "");

  const publicAppUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (publicAppUrl) return publicAppUrl.replace(/\/$/, "");

  const nextAuthUrl = (process.env.NEXTAUTH_URL || "").trim();
  if (nextAuthUrl) return nextAuthUrl.replace(/\/$/, "");

  const proto =
    (req.headers.get("x-forwarded-proto") || "https").split(",")[0]?.trim() ||
    "https";
  const host =
    (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim() ||
    (req.headers.get("host") || "").split(",")[0]?.trim() ||
    "";

  if (!host) return "";
  return `${proto}://${host}`;
}
