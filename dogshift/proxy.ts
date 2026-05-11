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

/**
 * Protected path prefixes. Anything matching these requires a session cookie
 * before the request is forwarded. Everything else passes through so:
 *   - Public marketing pages render normally.
 *   - Public API endpoints (/api/sitters, /api/auth/*, /api/webhooks/*, …)
 *     handle their own auth (or don't need any).
 *   - Unknown routes go through to Next.js and yield a real 404.
 *
 * Role-based authorization (owner vs sitter vs admin) is enforced one layer
 * down in route handlers, layouts, and `lib/adminAuth.ts`.
 */
const PROTECTED_PATH_PREFIX = [
  "/host", // matches "/host" and "/host/*"
  "/account", // matches "/account" and "/account/*"
  "/admin", // matches "/admin" and "/admin/*"
  "/api/host/",
  "/api/account/",
  "/api/admin/",
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

function isProtected(pathname: string): boolean {
  return PROTECTED_PATH_PREFIX.some((p) => {
    // Match both bare prefix ("/host") and child paths ("/host/", "/host/x").
    if (p.endsWith("/")) return pathname.startsWith(p);
    return pathname === p || pathname.startsWith(`${p}/`);
  });
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

  void searchParams;

  // Only protected prefixes need a session-cookie check. Everything else
  // (homepage, marketing pages, /api/sitters, /api/auth/*, …) passes
  // through; route handlers / layouts enforce auth themselves where they
  // care.
  if (isProtected(reqPathname) && !hasSessionCookie(req)) {
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
