import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  "/become-sitter",
  "/become-sitter/form",
  "/api/webhooks(.*)",
  "/api/clerk(.*)",
  "/api/become-sitter/apply",
  "/api/invites/verify",
]);

const isBecomeSitterInviteProtectedRoute = createRouteMatcher([
  "/become-sitter/form",
  "/api/become-sitter/apply",
]);

const isLockBypassRoute = createRouteMatcher([
  "/unlock(.*)",
  "/api/unlock(.*)",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/assets(.*)",
  "/images(.*)",
]);

type MiddlewareReqLike = {
  nextUrl?: {
    pathname?: unknown;
    searchParams?: URLSearchParams;
  };
};

function isPublicSitterRoute(req: MiddlewareReqLike) {
  const pathname = String(req?.nextUrl?.pathname ?? "");
  if (!pathname.startsWith("/sitter/") && !pathname.startsWith("/sitters/")) return false;
  const mode = String(req?.nextUrl?.searchParams?.get("mode") ?? "")
    .trim()
    .toLowerCase();
  return mode === "public" || mode === "";
}

function isRscLikeRequest(req: Request) {
  try {
    const url = new URL(req.url);
    return url.searchParams.has("_rsc");
  } catch {
    return false;
  }
}

export const proxy = clerkMiddleware(async (auth, req) => {
  const forwardedHost = (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim();
  const host = (forwardedHost || req.headers.get("host") || "").split(",")[0]?.trim().toLowerCase();
  if (process.env.NODE_ENV === "production" && host === "dogshift.ch") {
    const url = req.nextUrl.clone();
    url.host = "www.dogshift.ch";
    url.protocol = "https";
    return NextResponse.redirect(url, 308);
  }

  const pathname = String(req?.nextUrl?.pathname ?? "");

  const sitePassword = process.env.SITE_PASSWORD;
  const passwordSet = Boolean(sitePassword);
  const unlockedCookie = req.cookies.get("site_unlocked")?.value;
  const lockOn = passwordSet && unlockedCookie !== "1";

  const addLockHeaders = (res: NextResponse) => {
    res.headers.set("x-site-password-set", passwordSet ? "1" : "0");
    res.headers.set("x-site-lock-on", lockOn ? "1" : "0");
    return res;
  };
  if (sitePassword) {
    const { search } = req.nextUrl;

    const isNextAsset = pathname.startsWith("/_next/");
    const isStaticFile = /\.[^/]+$/.test(pathname);

    const isApiRoute = pathname.startsWith("/api/");
    const isImagesRoute = pathname.startsWith("/images/");
    const isFavicon = pathname === "/favicon.ico";

    if (!isApiRoute && !isFavicon && !isImagesRoute && !isLockBypassRoute(req) && !isPublicSitterRoute(req) && !isNextAsset && !isStaticFile) {
      if (unlockedCookie !== "1") {
        if (isRscLikeRequest(req)) {
          const res = NextResponse.json({ ok: false, locked: true }, { status: 401 });
          res.headers.set("x-dogshift-rsc-detected", "1");
          res.headers.set("x-dogshift-lock-layer", "next");
          return addLockHeaders(res);
        }

        const url = req.nextUrl.clone();
        url.pathname = "/unlock";
        url.search = `?next=${encodeURIComponent(pathname + search)}`;

        const res = NextResponse.redirect(url);
        res.headers.set("x-dogshift-lock-layer", "next");
        return addLockHeaders(res);
      }
    }
  }

  if (isBecomeSitterInviteProtectedRoute(req)) {
    const unlocked = req.cookies.get("ds_invite_unlocked")?.value ?? req.cookies.get("ds_invite")?.value;
    if (unlocked !== "1") {
      const pathname = String(req?.nextUrl?.pathname ?? "");
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ ok: false, error: "INVITE_REQUIRED" }, { status: 403 });
      }

      const url = req.nextUrl.clone();
      url.pathname = "/become-sitter";
      url.search = "";
      return addLockHeaders(NextResponse.redirect(url));
    }
  }

  if (isPublicRoute(req)) return addLockHeaders(NextResponse.next());
  if (pathname.startsWith("/api/")) {
    return addLockHeaders(NextResponse.next());
  }

  await auth();
  return addLockHeaders(NextResponse.next());
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
