import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  "/sign-out(.*)",
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

export const proxy = clerkMiddleware(async (auth, req) => {
  let reqUrl = "";
  let reqSearch = "";
  let reqHost = "";
  let reqPathname = "";

  try {
    const url = new URL(req.url);
    reqUrl = url.toString();
    reqSearch = url.search;
    reqHost = url.host;
    reqPathname = url.pathname;
  } catch {
    reqUrl = "";
    reqSearch = "";
    reqHost = "";
    reqPathname = "";
  }

  const pathname = String(req?.nextUrl?.pathname ?? "");

  const isApiRoute = pathname.startsWith("/api/");
  const isNextAsset = pathname.startsWith("/_next/");
  const isStaticFile = /\.[^/]+$/.test(pathname);

  const forwardedHost = (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim();
  const host = (forwardedHost || req.headers.get("host") || "").split(",")[0]?.trim().toLowerCase();
  if (process.env.NODE_ENV === "production" && host === "dogshift.ch") {
    const url = req.nextUrl.clone();
    url.host = "www.dogshift.ch";
    url.protocol = "https";
    return NextResponse.redirect(url, 308);
  }

  const addLockHeaders = (res: NextResponse) => {
    res.headers.set("x-site-password-set", "0");
    res.headers.set("x-site-lock-on", "0");
    res.headers.set("x-dogshift-req-url", reqUrl.slice(0, 200));
    res.headers.set("x-dogshift-req-search", (reqSearch || "").slice(0, 200));
    res.headers.set("x-dogshift-req-host", (reqHost || "").slice(0, 200));
    return res;
  };

  if (isBecomeSitterInviteProtectedRoute(req)) {
    const unlocked = req.cookies.get("ds_invite_unlocked")?.value ?? req.cookies.get("ds_invite")?.value;
    if (unlocked !== "1") {
      const pathname = String(req?.nextUrl?.pathname ?? "");
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ ok: false, error: "INVITE_REQUIRED" }, { status: 403 });
      }

      const url = req.nextUrl.clone();
      url.pathname = "/devenir-dogsitter";
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
