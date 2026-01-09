import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";

type RoleToken = JWT & { role?: string };

function nextWithPath(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-dogshift-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const rawHostHeader = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0] ?? "";
  const host = rawHostHeader.split(":")[0].toLowerCase();
  if (host === "dogshift.ch") {
    const url = req.nextUrl.clone();
    url.hostname = "www.dogshift.ch";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  if (pathname.startsWith("/api/auth")) return NextResponse.next();
  if (pathname.startsWith("/api")) return NextResponse.next();
  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (pathname === "/favicon.ico") return NextResponse.next();
  if (pathname.startsWith("/access")) return NextResponse.next();

  const isStaticAsset = /\.(png|jpg|jpeg|svg|webp|ico|txt|xml)$/i.test(pathname);
  const isNextAuthRoute = pathname.startsWith("/api/auth/");
  const isPopupClose = pathname === "/auth/popup-close" || pathname === "/auth/popup-close/";

  if (
    pathname.startsWith("/api/auth/callback/google") ||
    pathname.startsWith("/api/auth/error") ||
    pathname.startsWith("/api/auth/signin/google") ||
    pathname.startsWith("/api/auth/session")
  ) {
    const xfProto = (req.headers.get("x-forwarded-proto") || "").split(",")[0]?.trim();
    const xfHost = (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim();
    const hostHeader = (req.headers.get("host") || "").split(",")[0]?.trim();
    const proto = xfProto || "https";
    const derivedHost = xfHost || hostHeader;
    const derivedOrigin = derivedHost ? `${proto}://${derivedHost}` : null;
    const nextAuthUrlEnv = (process.env.NEXTAUTH_URL || "").trim() || null;
    const canonical = "https://www.dogshift.ch";
    const originMismatch = Boolean(nextAuthUrlEnv && nextAuthUrlEnv !== canonical);

    console.log(
      "[middleware][nextauth]",
      JSON.stringify(
        {
          ts: new Date().toISOString(),
          pathname,
          search: req.nextUrl.search,
          host: req.headers.get("host"),
          xForwardedHost: req.headers.get("x-forwarded-host"),
          xForwardedProto: req.headers.get("x-forwarded-proto"),
          derivedOrigin,
          NEXTAUTH_URL: nextAuthUrlEnv,
          expectedNEXTAUTH_URL: canonical,
          nextauthUrlMismatch: originMismatch,
          referer: req.headers.get("referer"),
          userAgent: req.headers.get("user-agent"),
        },
        null,
        2
      )
    );
  }

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    isNextAuthRoute ||
    isPopupClose ||
    isStaticAsset
  ) {
    return NextResponse.next();
  }

  const accessCode = (process.env.SITE_ACCESS_CODE ?? "").trim();
  if (accessCode) {
    const hasAccess = req.cookies.get("dogshift_access")?.value === "true";
    const isAccessPage = pathname === "/access";

    if (!hasAccess && !isAccessPage) {
      const url = req.nextUrl.clone();
      url.pathname = "/access";
      url.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(url);
    }
  }

  const isHost = pathname.startsWith("/host");
  const isAccount = pathname.startsWith("/account");

  if (!isHost && !isAccount) return nextWithPath(req);

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  const role = (token as RoleToken).role;

  if (isHost && role !== "SITTER") {
    const url = req.nextUrl.clone();
    url.pathname = "/account";
    return NextResponse.redirect(url);
  }

  if (isAccount && role !== "OWNER") {
    const url = req.nextUrl.clone();
    url.pathname = "/host";
    return NextResponse.redirect(url);
  }

  return nextWithPath(req);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|access).*)"],
};
