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
          window.location.assign("/login");
          return;
        }
        const data = await res.json().catch(() => null);
        const redirect = data?.redirect ?? "/host";
        const target = redirect === "/host" && next ? next : redirect;

        // Always use client-side navigation to stay within (protected)/ layout
        // so the TransitOverlay animation persists across the navigation.
        // HostDataGate will redirect non-sitter users to /account if needed.
        router.replace(target.startsWith("/host") ? target : "/host");
      } catch {
        window.location.assign("/login?force=1");
      }
    })();
  }, [router]);

  return null;
}
