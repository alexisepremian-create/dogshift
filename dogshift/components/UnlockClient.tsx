"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function UnlockClient({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeNext = useMemo(() => {
    if (typeof next !== "string") return "/";
    const trimmed = next.trim();
    if (!trimmed.startsWith("/")) return "/";
    if (trimmed.startsWith("//")) return "/";
    return trimmed;
  }, [next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, next: safeNext }),
      });

      if (!res.ok) {
        setError("Mot de passe incorrect.");
        return;
      }

      const data = (await res.json()) as { ok?: boolean; next?: string };
      const dest = typeof data?.next === "string" && data.next.startsWith("/") ? data.next : safeNext;
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Impossible de déverrouiller le site.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-4">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Accès privé</h1>
        <p className="mt-2 text-sm text-slate-600">Entrez le mot de passe pour accéder à DogShift.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="site-password" className="text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              id="site-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Déverrouillage..." : "Déverrouiller"}
          </button>
        </form>
      </div>
    </div>
  );
}
