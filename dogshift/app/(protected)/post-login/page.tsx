"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

function absolutePath(path: string): string {
  const p = (path || "").trim();
  if (!p.startsWith("/") || p.startsWith("//")) return "/account";
  if (typeof window === "undefined") return p;
  return `${window.location.origin}${p}`;
}

export default function PostLoginPage() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      router.replace("/login?force=1");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const next = (params.get("next") ?? "").trim();

    void (async () => {
      let res = await fetch("/api/auth/resolve-redirect", { cache: "no-store", credentials: "same-origin" });
      for (let i = 0; i < 10 && res.status === 401; i += 1) {
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
      const useNext = redirect.startsWith("/host") && next.startsWith("/") && !next.startsWith("//");
      const t = useNext ? next : redirect;
      const dest = t.startsWith("/") && !t.startsWith("//") ? t : "/account";
      window.location.replace(absolutePath(dest));
    })();
  }, [router, isLoaded, userId]);

  return null;
}
