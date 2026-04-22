"use client";

import Link from "next/link";
import { ArrowLeft, Bone, Dog, Heart } from "lucide-react";

import SitterApplicationForm from "@/components/SitterApplicationForm";

export default function CandidaterPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Dog className="absolute right-8 top-32 h-48 w-48 rotate-12 text-[#2f4d6b]/[0.06]" strokeWidth={1.5} />
        <Bone className="absolute bottom-32 left-8 h-36 w-36 -rotate-12 text-[#7969F0]/[0.06]" strokeWidth={1.5} />
        <Heart className="absolute left-10 top-24 h-32 w-32 -rotate-12 text-[#7969F0]/[0.04]" strokeWidth={1.5} />
      </div>

      <section className="relative z-10 mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
        <Link
          href="/devenir-dogsitter"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour
        </Link>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.18)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Candidature dog-sitter
          </p>
          <h1 className="mt-2 text-balance text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Postuler pour devenir dog-sitter DogShift
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Formulaire en 3 étapes (4–6 minutes). Candidature envoyée = pas
            d&rsquo;activation automatique. Nous te recontactons si ton profil
            est retenu.
          </p>

          <div className="mt-6">
            <SitterApplicationForm />
          </div>
        </div>
      </section>
    </main>
  );
}
