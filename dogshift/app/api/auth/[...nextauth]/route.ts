import NextAuth from "next-auth";

import { authOptions } from "@/lib/nextauth";

export const runtime = "nodejs";

const handler = NextAuth(authOptions);

async function logAndHandle(req: Request) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (
    pathname.startsWith("/api/auth/callback/") ||
    pathname.startsWith("/api/auth/error") ||
    pathname.startsWith("/api/auth/session")
  ) {
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

  const webReq = new Request(req);
  return (handler as unknown as (r: Request) => Promise<Response>)(webReq);
}

export { logAndHandle as GET, logAndHandle as POST };
