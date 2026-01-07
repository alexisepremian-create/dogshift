import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";

type RoleToken = JWT & { role?: string };

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isHost = pathname.startsWith("/host");
  const isAccount = pathname.startsWith("/account");

  if (!isHost && !isAccount) return NextResponse.next();

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/host/:path*", "/account/:path*"],
};
