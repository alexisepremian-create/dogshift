"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function AuthPopupPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const next = (searchParams?.get("next") ?? "").trim();

    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "dogshift:auth-popup", next }, window.location.origin);
      }
    } catch {
      // ignore
    }

    window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // ignore
      }
    }, 150);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-lg font-semibold text-slate-900">Connexion…</h1>
        <p className="mt-2 text-sm text-slate-600">Vous pouvez fermer cette fenêtre.</p>
      </main>
    </div>
  );
}
