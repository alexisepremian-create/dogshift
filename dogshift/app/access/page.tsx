"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AccessPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const safeNext = useMemo(() => {
    if (!next.startsWith("/")) return "/";
    if (next.startsWith("//")) return "/";
    if (next.startsWith("/api")) return "/";
    if (next.startsWith("/_next")) return "/";
    return next;
  }, [next]);

  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorText(null);

    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, next: safeNext }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; disabled?: boolean; error?: string } | null;

      if (!res.ok || !payload?.ok) {
        setStatus("error");
        setErrorText(payload?.error === "INVALID_CODE" ? "Code incorrect" : "Impossible de valider le code.");
        return;
      }

      window.location.href = safeNext;
    } catch {
      setStatus("error");
      setErrorText("Impossible de valider le code.");
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-16 text-slate-900">
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <img src="/dogshift-logo.png" alt="DogShift" className="h-[52px] w-auto" />
          <h1 className="mt-8 text-balance text-2xl font-semibold tracking-tight text-slate-900">Site bientôt dispo</h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-slate-600">
            DogShift arrive très bientôt. Le site est temporairement protégé par un code.
          </p>
        </div>

        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
          <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Code d’accès</span>
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                placeholder="••••••••"
                autoFocus
              />
            </label>

            {errorText ? <p className="text-sm font-medium text-rose-600">{errorText}</p> : null}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "submitting" ? "…" : "Continuer"}
            </button>

            <p className="text-xs text-slate-500">En cas de problème, contacte support@dogshift.ch.</p>
          </form>
        </div>
      </div>
    </main>
  );
}
