"use client";

import { useState } from "react";
import { Mail, Copy, Check, Clock } from "lucide-react";

import { useIsNativeAppSync } from "@/lib/native/useIsNativeAppSync";

const SUPPORT_EMAIL = "support@dogshift.ch";

export default function ContactPage() {
  const isNative = useIsNativeAppSync();
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main
        className={isNative ? "mx-auto w-full max-w-lg px-4" : "mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16"}
        style={isNative ? { paddingBottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 24px)" } : undefined}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7c3aed]/10 text-[#7c3aed]">
          <Mail className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Nous contacter</h1>
        <p className="mt-2 text-base text-slate-600">Une question, un souci sur une réservation ? Écris-nous, on répond vite.</p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Support client</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-lg font-bold text-slate-900">{SUPPORT_EMAIL}</p>
            <button
              type="button"
              onClick={() => void copyEmail()}
              aria-label="Copier l'adresse e-mail"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 active:scale-95"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7c3aed] px-6 py-3.5 text-sm font-semibold text-white active:bg-[#6d28d9]"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Écrire un e-mail
        </a>

        <div className="mt-5 flex items-start gap-2.5 text-sm text-slate-500">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span>Réponse généralement sous 24h (jours ouvrés). Support en français.</span>
        </div>
      </main>
    </div>
  );
}
