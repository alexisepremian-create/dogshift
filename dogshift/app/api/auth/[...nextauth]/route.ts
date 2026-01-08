import NextAuth from "next-auth/next";

import type { NextRequest } from "next/server";

import { authOptions } from "@/lib/nextauth";

const handler = NextAuth(authOptions);

async function logAndHandle(req: NextRequest) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/auth/callback/") || pathname.startsWith("/api/auth/error")) {
    console.log(
      "[nextauth-route][hit]",
      JSON.stringify(
        {
          ts: new Date().toISOString(),
          method: req.method,
          pathname,
          search: url.search,
          host: req.headers.get("host"),
          xForwardedHost: req.headers.get("x-forwarded-host"),
          xForwardedProto: req.headers.get("x-forwarded-proto"),
          referer: req.headers.get("referer"),
          userAgent: req.headers.get("user-agent"),
        },
        null,
        2
      )
    );
  }

  return handler(req);
}

export { logAndHandle as GET, logAndHandle as POST };
