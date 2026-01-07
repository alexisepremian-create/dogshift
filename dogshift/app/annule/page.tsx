import Link from "next/link";

export default function AnnulePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="space-y-4">
        <p className="text-xs font-semibold text-slate-600">Contribution</p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Paiement annulé</h1>
        <p className="text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">Aucun montant n’a été débité.</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/#contribution"
          className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
        >
          Réessayer
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
        >
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
