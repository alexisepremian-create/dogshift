"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

import { navigationPublicOrigin } from "@/lib/url/publicOrigin";

function absolutePath(path: string): string {
  const p = (path || "").trim();
  const origin = navigationPublicOrigin();
  if (!p.startsWith("/") || p.startsWith("//")) return `${origin}/account`;
  if (!origin) return p;
  return `${origin}${p}`;
}

export default function PostLoginPage() {
  const { isLoaded, userId } = useAuth();
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const runStartedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (runStartedRef.current) return;
    runStartedRef.current = true;

    let cancelled = false;

    void (async () => {
      const deadline = Date.now() + 5500;
      while (!cancelled && !userIdRef.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 180));
      }
      if (cancelled) return;
      if (!userIdRef.current) {
        window.location.replace(absolutePath("/login?force=1"));
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const next = (params.get("next") ?? "").trim();

      let res = await fetch("/api/auth/resolve-redirect", { cache: "no-store", credentials: "same-origin" });
      for (let i = 0; i < 12 && res.status === 401; i += 1) {
        await new Promise((r) => setTimeout(r, 200));
        res = await fetch("/api/auth/resolve-redirect", { cache: "no-store", credentials: "same-origin" });
      }
      if (res.status === 401) {
        window.location.replace(absolutePath("/login?force=1"));
        return;
      }
      const data = await res.json().catch(() => null);
      const redirect =
        typeof data?.redirect === "string" && data.redirect.startsWith("/") ? data.redirect : "/account";
      // Allow callers (e.g. /become-sitter/form login link) to specify a `next`
      // destination. We only honor it for known-safe prefixes to prevent open redirects.
      const SAFE_NEXT_PREFIXES = ["/host", "/become-sitter/", "/account"];
      const isSafeNext =
        next.startsWith("/") &&
        !next.startsWith("//") &&
        SAFE_NEXT_PREFIXES.some((prefix) => next.startsWith(prefix));
      const useNext = isSafeNext;
      const t = useNext ? next : redirect;
      const dest = t.startsWith("/") && !t.startsWith("//") ? t : "/account";
      window.location.replace(absolutePath(dest));
    })();

    return () => {
      cancelled = true;
      runStartedRef.current = false;
    };
  }, [isLoaded]);

  return null;
}
