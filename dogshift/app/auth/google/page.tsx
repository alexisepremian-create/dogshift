"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function AuthGooglePopupPage() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Redirection vers Google…");

  useEffect(() => {
    const next = (searchParams?.get("next") ?? "").trim();
    const callbackUrl = new URL("/auth/popup", window.location.origin);
    callbackUrl.searchParams.set("next", next ? next : "/post-login");

    void (async () => {
      try {
        await signIn(
          "google",
          {
            callbackUrl: callbackUrl.toString(),
          },
          { prompt: "select_account" }
        );
      } catch {
        setMessage("Impossible d’ouvrir Google. Vous pouvez fermer cette fenêtre.");
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-lg font-semibold text-slate-900">Connexion Google</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </main>
    </div>
  );
}
