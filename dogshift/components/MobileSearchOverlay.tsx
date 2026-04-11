"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  open: boolean;
  onClose: () => void;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(Boolean(mql.matches));
    onChange();
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return reduced;
}

export default function MobileSearchOverlay({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [service, setService] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);

  /* Mount / unmount with exit-animation delay */
  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      const t = window.setTimeout(() => setMounted(false), reduced ? 0 : 260);
      return () => window.clearTimeout(t);
    }
  }, [open, reduced]);

  /* Body scroll lock */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* Autofocus location input when opening */
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function handleSearch() {
    if (!service.trim() || !location.trim()) {
      setError("Veuillez sélectionner un service et renseigner votre lieu.");
      return;
    }
    const params = new URLSearchParams({ service, location: location.trim() });
    router.push(`/search?${params.toString()}`);
    onClose();
  }

  if (!mounted) return null;

  const visible = open;
  const transition = reduced ? "" : "transition-[opacity,transform] duration-[260ms] ease-out";

  return (
    <div
      className={`fixed inset-0 z-[90] md:hidden ${transition} ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      role="dialog"
      aria-modal="true"
      aria-label="Panneau de recherche"
    >
      {/* Full white background */}
      <div className="absolute inset-0 bg-white" />

      {/* Scrollable content */}
      <div
        className={`relative flex h-full flex-col overflow-auto ${transition} ${visible ? "translate-y-0" : "translate-y-3"}`}
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-3"
        >
          <div className="flex items-center gap-2 text-slate-400">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Recherche</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dogshift-blue)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Main block ── */}
        <div className="flex-1 px-5 pt-4">
          <h2 className="text-[1.65rem] font-semibold leading-[1.1] tracking-tight text-slate-900">
            Trouvez un dogsitter<br />près de chez vous.
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-500">
            Sélectionnez un service et renseignez votre ville pour découvrir les profils disponibles.
          </p>

          {/* ── Form ── */}
          <div className="mt-7 space-y-2.5">
            {/* Service */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5">
              <label htmlFor="overlay-service" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Service
              </label>
              <div className="relative mt-1.5">
                <select
                  id="overlay-service"
                  value={service}
                  onChange={(e) => { setService(e.target.value); setError(""); }}
                  className="block w-full appearance-none bg-transparent pr-7 text-[0.9rem] font-medium text-slate-900 outline-none [-moz-appearance:none] [-webkit-appearance:none]"
                >
                  <option value="" disabled>Choisir…</option>
                  <option value="Promenade">Promenade</option>
                  <option value="Garde">Garde</option>
                  <option value="Pension">Pension</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              </div>
            </div>

            {/* Lieu */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5">
              <label htmlFor="overlay-lieu" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Lieu
              </label>
              <input
                ref={inputRef}
                id="overlay-lieu"
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="ex. Genève, Lausanne"
                value={location}
                onChange={(e) => { setLocation(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
                className="mt-1.5 block w-full bg-transparent text-[0.9rem] font-medium text-slate-900 placeholder:text-slate-400 outline-none"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="px-1 text-xs font-medium text-red-500">{error}</p>
            )}

            {/* CTA */}
            <button
              type="button"
              onClick={handleSearch}
              className="w-full rounded-2xl bg-[var(--dogshift-blue)] py-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 ease-out hover:bg-[var(--dogshift-blue-hover)] active:scale-[0.98]"
            >
              Rechercher
            </button>
          </div>

          {/* ── Quick links ── */}
          <div className="mt-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Accès rapides
            </p>
            <div className="mt-3 divide-y divide-slate-100">
              <Link
                href="/search"
                onClick={onClose}
                className="flex items-center justify-between py-3.5 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
              >
                <span>Voir tous les dogsitters</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
              <Link
                href="/devenir-dogsitter"
                onClick={onClose}
                className="flex items-center justify-between py-3.5 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
              >
                <span>Devenir dogsitter</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
              <Link
                href="/search"
                onClick={onClose}
                className="flex items-center justify-between py-3.5 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
              >
                <span>Profils vérifiés près de chez vous</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
