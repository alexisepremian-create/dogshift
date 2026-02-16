"use client";

import { useMemo } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dbg = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return new URLSearchParams(window.location.search).get("dbg") === "1";
    } catch {
      return false;
    }
  }, []);

  const routeInfo = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return {
        pathname: window.location.pathname,
        search: window.location.search,
      };
    } catch {
      return null;
    }
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-xl font-semibold">Erreur application</h1>
        <p className="mt-3 text-sm text-slate-700">Une erreur client est survenue en chargeant cette page.</p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Message</p>
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-800">{error?.message || "(no message)"}</pre>

          {dbg ? (
            <>
              <p className="mt-5 text-sm font-semibold text-slate-900">Route</p>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-800">
                {routeInfo ? JSON.stringify(routeInfo, null, 2) : "(no route info)"}
              </pre>

              <p className="mt-5 text-sm font-semibold text-slate-900">Stack</p>
              <pre className="mt-2 max-h-[50vh] overflow-auto whitespace-pre-wrap break-words text-xs text-slate-800">
                {error?.stack || "(no stack)"}
              </pre>

              <p className="mt-5 text-sm font-semibold text-slate-900">Digest</p>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-800">{error?.digest || "(no digest)"}</pre>
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 text-sm font-semibold text-white"
        >
          Réessayer
        </button>
      </main>
    </div>
  );
}
