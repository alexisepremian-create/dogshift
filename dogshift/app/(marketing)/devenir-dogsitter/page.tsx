"use client";

import { useState } from "react";
import BecomeSitterAccessForm from "@/components/BecomeSitterAccessForm";

export default function DevenirDogsitterPage() {
  const [accessOpen, setAccessOpen] = useState(false);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <p className="text-xs font-semibold text-slate-600">Phase pilote</p>
        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          DogShift recrute ses 20 premiers dog-sitters
        </h1>
        <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
          Profils sélectionnés manuellement – Phase pilote Lausanne &amp; Riviera
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.12)] sm:p-8">
            <p className="text-xs font-semibold text-slate-600">Nouveau sitter</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Postuler pour devenir dog-sitter</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Formulaire en 3 étapes (4–6 minutes). Sélection manuelle.
            </p>
            <a
              href="/devenir-dogsitter/candidater"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            >
              Postuler maintenant
            </a>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.12)] sm:p-8">
            <p className="text-xs font-semibold text-slate-600">Déjà sélectionné</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Entrer ton code d&rsquo;accès</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Tu as reçu un code du type DS-XXXX-XXXX ? Déverrouille ton espace sitter.
            </p>
            <button
              type="button"
              onClick={() => setAccessOpen(true)}
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              Entrer mon code
            </button>
          </div>
        </div>

        <div id="comment-ca-marche" className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.15)] sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Comment ça marche</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">1. Tu candidates</p>
              <p className="mt-2 text-sm text-slate-600">Un formulaire en 3 étapes, simple et structuré.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">2. On analyse ton profil</p>
              <p className="mt-2 text-sm text-slate-600">Sélection manuelle, qualité avant quantité.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">3. On te contacte si ton profil est retenu</p>
              <p className="mt-2 text-sm text-slate-600">Mini entretien pour valider l&rsquo;adéquation.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">4. Validation + profil activé</p>
              <p className="mt-2 text-sm text-slate-600">Ton profil est ensuite activé sur la plateforme.</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.12)] sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">Ce qu&rsquo;on recherche</h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>Fiabilité</p>
              <p>Amour des chiens</p>
              <p>Disponibilité</p>
              <p>Sérieux</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.12)] sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">Avantages</h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>Revenus flexibles</p>
              <p>Clients locaux</p>
              <p>Paiement sécurisé</p>
              <p>Tu choisis tes disponibilités</p>
              <p>Plateforme suisse</p>
            </div>
          </div>
        </div>
      </section>

      {accessOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Fermer"
            onClick={() => setAccessOpen(false)}
          />
          <div className="relative z-10">
            <div className="absolute -right-2 -top-2">
              <button
                type="button"
                onClick={() => setAccessOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <BecomeSitterAccessForm onUnlocked={() => setAccessOpen(false)} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
