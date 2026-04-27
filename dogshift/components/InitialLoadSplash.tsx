"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import PageLoader from "@/components/ui/PageLoader";

// Public entry pages where the splash is more annoying than helpful: the user
// types the URL or clicks an external link and expects the page to appear
// immediately. We still render an instant fade for everything else (account
// pages, host dashboard, admin) where data fetching warrants a brief splash.
const PUBLIC_ENTRY_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/login(\/.*)?$/,
  /^\/sign-out(\/.*)?$/,
  /^\/become-sitter(\/.*)?$/,
  /^\/devenir-dogsitter(\/.*)?$/,
  /^\/contract\/sign(\/.*)?$/,
  /^\/auth\//,
];

function isPublicEntryPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_ENTRY_PATTERNS.some((p) => p.test(pathname));
}

export default function InitialLoadSplash() {
  const pathname = usePathname();
  const [done, setDone] = useState(false);
  const [pageReady, setPageReady] = useState(false);

  useEffect(() => {
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
  }, []);

  if (done) return null;
  if (isPublicEntryPath(pathname)) return null;

  return <PageLoader ready={pageReady} onDone={() => setDone(true)} />;
}
