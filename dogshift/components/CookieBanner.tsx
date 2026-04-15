"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { getConsentCookie, setConsentCookie, type ConsentLevel } from "@/lib/cookieConsent";

interface Props {
  onConsent?: (level: ConsentLevel) => void;
}

export default function CookieBanner({ onConsent }: Props) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setMounted(true);
    const existing = getConsentCookie();
    if (!existing) {
      // Small delay so it doesn't pop immediately on page load
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss(level: ConsentLevel) {
    setExiting(true);
    setConsentCookie(level);
    onConsent?.(level);
    setTimeout(() => setVisible(false), 400);
  }

  if (!mounted || !visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Gestion des cookies"
      aria-modal="false"
      className={[
        "fixed bottom-0 left-0 right-0 z-[9998] px-4 pb-4 sm:bottom-5 sm:left-5 sm:right-auto sm:w-full sm:max-w-md sm:px-0",
        "transition-all duration-500 ease-out",
        exiting
          ? "translate-y-4 opacity-0"
          : "translate-y-0 opacity-100",
      ].join(" ")}
    >
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_32px_80px_-16px_rgba(2,6,23,0.22)] backdrop-blur-xl">

        {/* Subtle gradient accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--dogshift-blue)]/40 to-transparent" />

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl" aria-hidden="true">🍪</span>
              <p className="text-sm font-semibold text-slate-900">Gestion des cookies</p>
            </div>
            <button
              type="button"
              aria-label="Fermer (refuser les cookies non essentiels)"
              onClick={() => dismiss("essential")}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-600">
            DogShift utilise des cookies essentiels (connexion, réservations) et, avec votre accord,
            des cookies publicitaires{" "}
            <span className="font-medium text-slate-700">(Google Ads)</span>{" "}
            pour mesurer l'efficacité de nos campagnes. Vos données ne sont jamais vendues.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => dismiss("all")}
              className="flex-1 rounded-2xl bg-[var(--dogshift-blue)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)]"
            >
              Tout accepter
            </button>
            <button
              type="button"
              onClick={() => dismiss("essential")}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
            >
              Refuser
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-slate-400">
            En cliquant sur « Tout accepter », vous acceptez notre{" "}
            <Link
              href="/confidentialite"
              className="underline underline-offset-2 transition hover:text-slate-600"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
