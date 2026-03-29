"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function PostLoginPage() {
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    try { sessionStorage.setItem("ds_login_transit", String(Date.now())); } catch {}

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
        const redirect = data?.redirect ?? "/host";
        const t = redirect === "/host" && next ? next : redirect;
        router.replace(t.startsWith("/host") ? t : "/host");
      } catch {
        router.replace("/login?force=1");
      }
    })();
  }, [router]);

  return null;
}
