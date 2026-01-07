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

  const isStaticAsset = /\.(png|jpg|jpeg|svg|webp|ico|txt|xml)$/i.test(pathname);

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
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
  matcher: ["/:path*"],
};
