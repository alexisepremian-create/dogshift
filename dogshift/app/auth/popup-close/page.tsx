"use client";

import { useEffect, useState } from "react";

export default function AuthPopupClosePage() {
  const [closeFailed, setCloseFailed] = useState(false);

  useEffect(() => {
    const opener = window.opener;
    if (opener && typeof opener.postMessage === "function") {
      try {
        opener.postMessage({ type: "DOGSHIFT_AUTH_SUCCESS" }, "https://www.dogshift.ch");
      } catch {
        // ignore
      }
    }

    const t = window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // ignore
      }

      window.setTimeout(() => {
        if (!window.closed) {
          setCloseFailed(true);
        }
      }, 150);
    }, 300);

    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-14">
        <h1 className="text-2xl font-semibold tracking-tight">Connexion réussie</h1>
        <p className="text-sm text-slate-600">Tu peux fermer cette fenêtre et retourner sur DogShift.</p>
        {closeFailed ? (
          <button
            type="button"
            onClick={() => {
              try {
                window.close();
              } catch {
                // ignore
              }
            }}
            className="mt-2 w-full rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Fermer la fenêtre
          </button>
        ) : null}
      </main>
    </div>
  );
}
