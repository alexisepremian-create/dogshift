import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-level routing proxy (Next.js 16 `proxy.ts`, replaces the old
 * `middleware.ts` naming).
 *
 * Design notes for the Clerk → Auth.js v5 migration:
 *
 *  - Auth.js v5 supports **database** sessions, which is what we use for
 *    instant revocation (Stripe Connect requirement). Validating those
 *    sessions requires a Prisma query, which is NOT available in the Edge
 *    runtime. Rather than force middleware into Node (slower cold starts),
 *    we keep this proxy edge-safe: it only inspects cookies/headers and
 *    does the cheap routing checks.
 *
 *  - **Role-based authorization** (sitter vs owner vs admin) is enforced
 *    one layer down — in route handlers, layouts, and `lib/adminAuth.ts`
 *    (which already does the belt+suspenders ADMIN_EMAILS + cookie check).
 *    All this proxy does is gate "is the user signed in at all".
 *
 *  - Removed paths still return 410 Gone before any auth check.
 *
 *  - `next=` parameter is built from the originally requested pathname
 *    + search so that post-login we land back where we were.
 */

const PUBLIC_PATH_EXACT = new Set([
  "/",
  "/login",
  "/signup",
  "/sign-out",
  "/forgot-password",
  "/reset-password",
  "/check-email",
  "/verify-email",
  "/post-login",
  "/become-sitter",
  "/devenir-dogsitter",
]);

const PUBLIC_PATH_PREFIX = [
  "/login/", // login subpages (e.g. /login/[...rest])
  "/sign-out/",
  "/auth/", // legacy /auth/google etc.
  "/sitter/", // public sitter profiles (mode=public default)
  "/sitters/",
  "/devenir-dogsitter/",
  "/zootherapie",
  "/etiquette-promenade",
  "/guide-dogsitter",
  "/blog",
  "/onboarding", // public welcome page
  "/sign-out",
];

const PUBLIC_API_PREFIX = [
  "/api/auth/", // Auth.js handler, forgot/reset password, register
  "/api/webhooks/", // Stripe, Clerk legacy (no-op), etc.
  "/api/clerk/", // legacy Clerk-callback path kept for compat
  "/api/platform/status",
  "/api/become-sitter/apply",
  "/api/invites/verify",
  "/api/public/",
  "/api/lead-magnet/",
  "/api/debug/",
];

const REMOVED_EXACT_PATHS = new Set([
  "/access",
  "/unlock",
  "/travel-dog-bowl",
  "/toys",
  "/etiquette-produit",
  "/abonnements-dogshift",
]);

const REMOVED_PATH_PREFIXES = ["/etiquette-produit/"];

const INVITE_PROTECTED_PATHS = new Set(["/become-sitter/form", "/api/become-sitter/apply"]);

// Auth.js v5 session cookie name. Differs between HTTP (dev) and HTTPS (prod).
const AUTHJS_SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

function isRemovedPath(pathname: string): boolean {
  if (REMOVED_EXACT_PATHS.has(pathname)) return true;
  return REMOVED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isPublicSitterRoute(pathname: string, searchParams: URLSearchParams): boolean {
  if (!pathname.startsWith("/sitter/") && !pathname.startsWith("/sitters/")) return false;
  const mode = (searchParams.get("mode") ?? "").trim().toLowerCase();
  return mode === "public" || mode === "";
}

function isPublic(pathname: string, searchParams: URLSearchParams): boolean {
  if (PUBLIC_PATH_EXACT.has(pathname)) return true;
  if (PUBLIC_PATH_PREFIX.some((p) => pathname.startsWith(p))) return true;
  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API_PREFIX.some((p) => pathname.startsWith(p))) return true;
    return false;
  }
  if (isPublicSitterRoute(pathname, searchParams)) return true;
  // Marketing pages without a query: rely on prefixes above. Anything that
  // isn't whitelisted here drops to the auth check below.
  return false;
}

function hasSessionCookie(req: NextRequest): boolean {
  return AUTHJS_SESSION_COOKIES.some((name) => Boolean(req.cookies.get(name)?.value));
}

function buildNextParam(pathname: string, search: string): string {
  const target = `${pathname}${search || ""}`;
  return target.startsWith("/") ? target : "/";
}

export function proxy(req: NextRequest): NextResponse {
  let reqUrl = "";
  let reqSearch = "";
  let reqHost = "";
  let reqPathname = "";
  let searchParams = new URLSearchParams();

  try {
    const url = new URL(req.url);
    reqUrl = url.toString();
    reqSearch = url.search;
    reqHost = url.host;
    reqPathname = url.pathname;
    searchParams = url.searchParams;
  } catch {
    /* leave defaults */
  }

  // Apex domain → www in prod (HTTPS).
  const forwardedHost = (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim();
  const host = (forwardedHost || req.headers.get("host") || "").split(",")[0]?.trim().toLowerCase();
  if (process.env.NODE_ENV === "production" && host === "dogshift.ch") {
    const url = req.nextUrl.clone();
    url.host = "www.dogshift.ch";
    url.protocol = "https";
    return NextResponse.redirect(url, 308);
  }

  // 410 Gone for retired URLs (legal + SEO).
  if (isRemovedPath(reqPathname)) {
    const res = new NextResponse("Gone", { status: 410 });
    res.headers.set("x-robots-tag", "noindex, nofollow");
    res.headers.set("cache-control", "public, max-age=0, s-maxage=86400");
    return res;
  }

  const addLockHeaders = (res: NextResponse) => {
    res.headers.set("x-site-password-set", "0");
    res.headers.set("x-site-lock-on", "0");
    res.headers.set("x-dogshift-req-url", reqUrl.slice(0, 200));
    res.headers.set("x-dogshift-req-search", (reqSearch || "").slice(0, 200));
    res.headers.set("x-dogshift-req-host", (reqHost || "").slice(0, 200));
    return res;
  };

  // Invite-gated pilot routes.
  if (INVITE_PROTECTED_PATHS.has(reqPathname)) {
    const unlocked =
      req.cookies.get("ds_invite_unlocked")?.value ?? req.cookies.get("ds_invite")?.value;
    if (unlocked !== "1") {
      if (reqPathname.startsWith("/api/")) {
        return NextResponse.json({ ok: false, error: "INVITE_REQUIRED" }, { status: 403 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/devenir-dogsitter";
      url.search = "";
      return addLockHeaders(NextResponse.redirect(url));
    }
  }

  // Public routes pass straight through (no auth check).
  if (isPublic(reqPathname, searchParams)) {
    return addLockHeaders(NextResponse.next());
  }

  // Everything else needs a session cookie. We do NOT validate the session
  // against the DB here (Edge runtime + Prisma is unsupported); role checks
  // are enforced in route handlers + layouts downstream. This proxy only
  // shields protected pages from anonymous visitors.
  if (!hasSessionCookie(req)) {
    // API: respond with JSON 401 — UI handles the "logged out" UX.
    if (reqPathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(buildNextParam(reqPathname, reqSearch))}`;
    return addLockHeaders(NextResponse.redirect(url));
  }

  return addLockHeaders(NextResponse.next());
}

export const config = {
  // Skip Next.js internals, static assets, and image optimization.
  matcher: ["/((?!_next|.*\\..*).*)"],
};
