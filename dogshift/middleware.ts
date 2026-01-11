import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  "/api/webhooks(.*)",
  "/api/clerk(.*)",
]);

const isLockBypassRoute = createRouteMatcher([
  "/unlock(.*)",
  "/api/unlock(.*)",
  "/api(.*)",
  "/api/stripe/webhook(.*)",
  "/host(.*)",
  "/account(.*)",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/assets(.*)",
  "/images(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword) {
    const { pathname, search } = req.nextUrl;

    const isNextAsset = pathname.startsWith("/_next/");
    const isStaticFile = /\.[^/]+$/.test(pathname);

    if (!isLockBypassRoute(req) && !isNextAsset && !isStaticFile) {
      const unlocked = req.cookies.get("site_unlocked")?.value;
      if (unlocked !== "1") {
        const url = req.nextUrl.clone();
        url.pathname = "/unlock";
        url.search = `?next=${encodeURIComponent(pathname + search)}`;
        return NextResponse.redirect(url);
      }
    }
  }

  if (isPublicRoute(req)) return;

  await auth();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
