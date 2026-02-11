export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.25)] sm:p-10">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Politique de confidentialité – DogShift</h1>
          <p className="mt-3 text-sm text-slate-600">
            Version en vigueur dès sa publication. Cette politique décrit comment DogShift traite les données personnelles dans le cadre de la plateforme.
          </p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-slate-700">
            <section>
              <h2 className="text-base font-semibold text-slate-900">1. Données de vérification d’identité</h2>
              <p className="mt-3">
                DogShift peut proposer aux dogsitters de soumettre, sur une base volontaire, une copie d’une pièce d’identité et, le cas échéant, un selfie afin
                d’obtenir l’affichage d’un badge « Profil vérifié ». Ces données sont traitées à des fins de confiance et de sécurité (trust & safety).
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Données collectées</p>
                <p className="mt-2">Pièce d’identité (image ou PDF) et, le cas échéant, selfie (image).</p>

                <p className="mt-4 text-sm font-semibold text-slate-900">Finalités</p>
                <p className="mt-2">
                  Vérification manuelle visuelle de cohérence, prévention des abus, amélioration de la confiance sur la plateforme, gestion de litiges et respect
                  d’obligations légales.
                </p>

                <p className="mt-4 text-sm font-semibold text-slate-900">Base légale</p>
                <p className="mt-2">
                  Le traitement est fondé sur l’exécution du contrat d’utilisation de la plateforme ainsi que sur l’intérêt légitime de DogShift à assurer la sécurité,
                  la confiance et la prévention des abus. Lorsque cela est requis, DogShift peut également se fonder sur une obligation légale.
                </p>

                <p className="mt-4 text-sm font-semibold text-slate-900">Aucun usage commercial</p>
                <p className="mt-2">
                  Les documents d’identité ne sont jamais utilisés à des fins commerciales, marketing, de prospection, ni de profilage.
                </p>

                <p className="mt-4 text-sm font-semibold text-slate-900">Stockage et accès</p>
                <p className="mt-2">
                  Les documents sont stockés dans un espace privé, avec accès restreint aux personnes autorisées au sein de DogShift. Ils ne sont pas accessibles au
                  public.
                </p>
                <p className="mt-2">
                  Lorsque l’accès est nécessaire à l’examen interne, DogShift peut utiliser des liens temporaires sécurisés (URLs présignées) d’une durée de validité
                  de soixante (60) secondes.
                </p>

                <p className="mt-4 text-sm font-semibold text-slate-900">Durée de conservation et suppression</p>
                <p className="mt-2">
                  Sauf obligation légale, prévention de la fraude ou gestion d’un litige, DogShift supprime définitivement les documents au plus tard trente (30) jours
                  après la décision de vérification (approbation ou refus).
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">2. Contact</h2>
              <p className="mt-3">
                Pour toute question relative au traitement de vos données personnelles, vous pouvez contacter DogShift à l’adresse suivante : support@dogshift.ch.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
