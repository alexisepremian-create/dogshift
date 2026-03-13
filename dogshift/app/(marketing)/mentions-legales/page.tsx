export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.25)] sm:p-10">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Mentions légales – DogShift</h1>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-slate-700">
            <section>
              <h2 className="text-base font-semibold text-slate-900">Éditeur du site</h2>
              <div className="mt-3 space-y-1">
                <p>DogShift</p>
                <p>Alexis Epremian</p>
                <p>Rue du lac 128</p>
                <p>1815 Clarens</p>
                <p>Suisse</p>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">Contact</h2>
              <p className="mt-3">support@dogshift.ch</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">Description du service</h2>
              <p className="mt-3">
                DogShift est une plateforme permettant de mettre en relation des propriétaires de chiens avec des dogsitters
                indépendants pour des services de promenade, garde ou visite à domicile.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">Hébergement</h2>
              <p className="mt-3">Le site est hébergé par Vercel Inc.</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
