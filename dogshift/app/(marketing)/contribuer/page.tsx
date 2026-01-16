import Link from "next/link";

export default function ContribuerPage({
  searchParams,
}: {
  searchParams?: { canceled?: string };
}) {
  const canceled = searchParams?.canceled === "1";

  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="space-y-4">
        <p className="text-xs font-semibold text-slate-600">Contribution</p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Soutenir le lancement de DogShift
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
          DogShift est en phase pilote. Votre soutien est volontaire et aide à financer le développement, l’infrastructure et les outils nécessaires à une
          expérience fiable.
        </p>
        {canceled ? (
          <p className="text-sm font-medium text-slate-700">Paiement annulé — vous pouvez réessayer à tout moment.</p>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
        >
          Retour à l’accueil
        </Link>
        <Link
          href="/help"
          className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
        >
          Nous contacter
        </Link>
      </div>
    </main>
  );
}
