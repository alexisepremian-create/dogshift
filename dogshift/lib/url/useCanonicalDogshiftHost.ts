"use client";

import { useEffect } from "react";

/**
 * Client-side mirror of middleware: production users often open `dogshift.ch`
 * while Clerk / cookies / NEXT_PUBLIC_APP_URL are aligned on `www.dogshift.ch`.
 * Without this, OAuth can complete on one host while the session is read on another.
 */
export function useCanonicalDogshiftHostRedirect() {
  useEffect(() => {
    const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
    if (!raw || typeof window === "undefined") return;
    try {
      const want = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      const cur = new URL(window.location.href);
      if (cur.hostname === "dogshift.ch" && want.hostname === "www.dogshift.ch") {
        cur.hostname = want.hostname;
        window.location.replace(cur.toString());
      }
    } catch {
      /* ignore */
    }
  }, []);
}
