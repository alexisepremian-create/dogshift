import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { clerkMiddleware } from "@clerk/nextjs/server";

function nextWithPath(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-dogshift-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function isStaticAssetPath(pathname: string) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico|txt|xml|woff2?|ttf|otf|eot|map|css|js)$/i.test(pathname);
}

export const middleware = clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  const rawHostHeader = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0] ?? "";
  const host = rawHostHeader.split(":")[0].toLowerCase();
  if (host === "dogshift.ch") {
    const url = req.nextUrl.clone();
    url.hostname = "www.dogshift.ch";
    url.protocol = "https:";
    return NextResponse.redirect(url, 301);
  }

  if (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/_next/") ||
    pathname === "/_next" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    isStaticAssetPath(pathname)
  ) {
    return NextResponse.next();
  }

  const { userId } = await auth();
  if (userId) {
    return nextWithPath(req);
  }

  if (pathname === "/login" || pathname === "/signup") {
    return nextWithPath(req);
  }

  const accessCode = (process.env.SITE_ACCESS_CODE ?? "").trim();
  if (accessCode) {
    const hasAccess = req.cookies.get("dogshift_access")?.value === "true";
    const isAccessPage = pathname === "/access";

    if (!hasAccess && !isAccessPage) {
      const url = req.nextUrl.clone();
      url.pathname = "/access";
      url.searchParams.set("next", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  return nextWithPath(req);
});

export const config = {
  matcher: ["/((?!api|_next|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\..*).*)"],
};
