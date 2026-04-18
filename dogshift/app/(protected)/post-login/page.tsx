"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function PostLoginPage() {
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const next = (params.get("next") ?? "").trim();

    (async () => {
      try {
        const res = await fetch("/api/auth/resolve-redirect", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json().catch(() => null);
        const redirect = typeof data?.redirect === "string" && data.redirect.startsWith("/") ? data.redirect : "/account";
        const useNext = redirect.startsWith("/host") && next.startsWith("/") && !next.startsWith("//");
        const t = useNext ? next : redirect;
        router.replace(t.startsWith("/") && !t.startsWith("//") ? t : "/account");
      } catch {
        router.replace("/login?force=1");
      }
    })();
  }, [router]);

  return null;
}
