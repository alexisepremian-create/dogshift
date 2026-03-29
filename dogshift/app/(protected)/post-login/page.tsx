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
          window.location.assign("/login");
          return;
        }
        const data = await res.json().catch(() => null);
        const target = data?.redirect ?? "/account";
        const finalTarget = target === "/host" && next ? next : target;

        if (finalTarget.startsWith("/host")) {
          router.replace(finalTarget);
        } else {
          window.location.replace(finalTarget);
        }
      } catch {
        window.location.assign("/login?force=1");
      }
    })();
  }, [router]);

  return null;
}
