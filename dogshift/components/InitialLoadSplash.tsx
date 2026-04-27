"use client";

import { useEffect, useState } from "react";

import PageLoader from "@/components/ui/PageLoader";

export default function InitialLoadSplash() {
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

  return <PageLoader ready={pageReady} onDone={() => setDone(true)} />;
}
