"use client";

export default function HostContractPage() {
  return (
    <div className="relative grid gap-6 overflow-hidden" data-testid="host-contract-page-locked">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:p-8">
        <p className="text-sm font-semibold text-slate-600">Signature du contrat</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Lien sécurisé requis</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
          La signature du contrat DogShift se fait désormais uniquement via un lien sécurisé personnel envoyé par email après sélection manuelle de votre candidature.
        </p>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Dashboard non autorisé pour la signature</p>
          <p className="mt-1 text-sm text-amber-900/80">
            Pour des raisons de sécurité et de traçabilité, aucun contrat ne peut être signé depuis l’espace dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
