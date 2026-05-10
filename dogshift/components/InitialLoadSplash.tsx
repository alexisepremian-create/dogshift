/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import PageLoader from "@/components/ui/PageLoader";

/** Public entry pages that must load instantly (no splash) when arriving from
 * an external link or a hard navigation. Splash is reserved for protected/long
 * pages where data fetching needs visual cover. */
const SPLASH_SKIP_PATHS = [
  "/",
  "/login",
  "/sign-out",
  "/post-login",
  "/become-sitter",
  "/devenir-dogsitter",
  "/contract/sign",
  "/auth",
];

function shouldSkipSplash(pathname: string | null): boolean {
  // When pathname can't be resolved (e.g. during the initial SSR pass when a
  // parent Suspense bailed out to client-side rendering), default to SKIP so
  // we never render a blocking splash on the bare HTML payload that the
  // browser receives. The splash is only useful client-side once routing is
  // resolved; if we render it server-side without context, mobile devices
  // can be stuck staring at it for the entire JS parse window.
  if (!pathname) return true;
  return SPLASH_SKIP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function InitialLoadSplash() {
  const pathname = usePathname();
  // Only render after first client-side mount. This guarantees the splash
  // never appears in the SSR HTML payload — which is critical because when
  // the page tree bails out to CSR, the SSR'd splash would otherwise stay
  // visible on top of an empty viewport for the entire hydration window.
  const [mounted, setMounted] = useState(false);
  const [done, setDone] = useState(false);
  const [pageReady, setPageReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const skip = shouldSkipSplash(pathname);

  useEffect(() => {
    if (!mounted || skip) return;
    if (typeof document === "undefined") return;

    if (document.readyState === "complete") {
      setPageReady(true);
      return;
    }

    const onLoad = () => setPageReady(true);
    window.addEventListener("load", onLoad, { once: true });

    // Safety: if window.load never fires (webview, slow 3G), unblock after 4s
    const safetyTimer = window.setTimeout(() => setPageReady(true), 4000);

    return () => {
      window.removeEventListener("load", onLoad);
      window.clearTimeout(safetyTimer);
    };
  }, [mounted, skip]);

  if (!mounted || skip || done) return null;

  // Reduced from 2400ms → 800ms: long splash created perceived sluggishness on
  // every navigation. 800ms is enough to cover hydration on most devices.
  return <PageLoader ready={pageReady} onDone={() => setDone(true)} minDuration={800} />;
}