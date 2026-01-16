import Link from "next/link";

export default function ShopPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="relative mx-auto max-w-3xl">
          <div className="pointer-events-none rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] blur-[2px] sm:p-10">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Boutique</h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Bientôt disponible. Une sélection d&apos;accessoires premium, validés par nos sitters.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-sm font-semibold text-slate-900">Harnais premium</p>
                <p className="mt-2 text-sm text-slate-600">Confort & sécurité pour chaque promenade.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-sm font-semibold text-slate-900">Couchage design</p>
                <p className="mt-2 text-sm text-slate-600">Matériaux durables et finitions haut de gamme.</p>
              </div>
            </div>

            <div className="mt-10">
              <Link
                href="/search"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                Voir les sitters
              </Link>
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-3xl border border-slate-200 bg-white/90 px-6 py-5 text-center shadow-[0_18px_60px_-46px_rgba(2,6,23,0.25)] backdrop-blur">
              <p className="text-base font-semibold text-slate-900">La boutique sera bientôt disponible</p>
              <p className="mt-1 text-sm text-slate-600">Revenez bientôt.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
