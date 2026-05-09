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
  "/become-sitter",
  "/devenir-dogsitter",
  "/contract/sign",
  "/auth",
];

function shouldSkipSplash(pathname: string | null): boolean {
  if (!pathname) return false;
  return SPLASH_SKIP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function InitialLoadSplash() {
  const pathname = usePathname();
  const [done, setDone] = useState(false);
  const [pageReady, setPageReady] = useState(false);

  // Skip splash entirely on public entry pages — homepage etc. should land instantly
  const skip = shouldSkipSplash(pathname);

  useEffect(() => {
    if (skip) return;
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
  }, [skip]);

  if (skip || done) return null;

  // Reduced from 2400ms → 800ms: long splash created perceived sluggishness on
  // every navigation. 800ms is enough to cover hydration on most devices.
  return <PageLoader ready={pageReady} onDone={() => setDone(true)} minDuration={800} />;
}
