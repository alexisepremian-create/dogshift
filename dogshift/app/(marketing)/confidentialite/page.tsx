export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.25)] sm:p-10">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Politique de confidentialité – DogShift
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Dernière mise à jour : mai 2026. Cette politique décrit comment DogShift traite les données
            personnelles dans le cadre de la plateforme, conformément à la loi fédérale suisse sur la
            protection des données (nLPD) et, le cas échéant, au Règlement général sur la protection des
            données (RGPD) de l'Union européenne.
          </p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-slate-700">

            {/* 1. Responsable du traitement */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">1. Responsable du traitement</h2>
              <p className="mt-3">
                Le responsable du traitement des données personnelles collectées via la plateforme DogShift
                est DogShift, domicilié en Suisse. Pour toute question relative à vos données personnelles,
                vous pouvez nous contacter à l'adresse suivante :{" "}
                <a href="mailto:support@dogshift.ch" className="text-slate-900 underline underline-offset-2">
                  support@dogshift.ch
                </a>
                .
              </p>
            </section>

            {/* 2. Données collectées */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">2. Données personnelles collectées</h2>
              <p className="mt-3">
                Nous collectons les données suivantes selon les interactions avec la plateforme :
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Données de compte</p>
                  <p className="mt-1 text-slate-600">Prénom, nom, adresse email, numéro de téléphone (sitters uniquement), photo de profil optionnelle.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Données de réservation</p>
                  <p className="mt-1 text-slate-600">Dates, services, montants, historique de transactions, identifiants de paiement Stripe.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Données de profil sitter</p>
                  <p className="mt-1 text-slate-600">Localisation (ville, code postal, coordonnées GPS), biographie, disponibilités, tarifs, services proposés, taille des chiens acceptés.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Données de vérification d'identité (sitters)</p>
                  <p className="mt-1 text-slate-600">Sur base volontaire : pièce d'identité et selfie pour l'obtention du badge « Profil vérifié ».</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Données de messagerie</p>
                  <p className="mt-1 text-slate-600">Contenu des messages échangés entre propriétaires et sitters via la messagerie interne de la plateforme.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Données techniques</p>
                  <p className="mt-1 text-slate-600">Adresse IP, user-agent, données de session, logs d'erreurs (via Sentry), données de navigation anonymisées.</p>
                </div>
              </div>
            </section>

            {/* 3. Finalités et bases légales */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">3. Finalités et bases légales du traitement</h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Exécution du contrat</p>
                  <p className="mt-1 text-slate-600">Gestion des comptes, réservations, paiements, messagerie entre utilisateurs, virement aux sitters.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Intérêt légitime</p>
                  <p className="mt-1 text-slate-600">Sécurité de la plateforme, prévention de la fraude, monitoring des erreurs, amélioration du service.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Obligation légale</p>
                  <p className="mt-1 text-slate-600">Conservation des archives financières (transactions, factures) conformément aux obligations comptables suisses.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Consentement</p>
                  <p className="mt-1 text-slate-600">Envoi de communications marketing, utilisation de cookies de mesure d'audience et de publicité (si applicable).</p>
                </div>
              </div>
            </section>

            {/* 4. Durée de conservation */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">4. Durée de conservation</h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-900">Type de données</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-900">Durée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-4 py-3 text-slate-700">Données de compte (actif)</td>
                      <td className="px-4 py-3 text-slate-700">Pendant la durée d'utilisation du compte</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-700">Données de réservation / transactions</td>
                      <td className="px-4 py-3 text-slate-700">10 ans (obligation légale comptable suisse)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-700">Documents d'identité (vérification)</td>
                      <td className="px-4 py-3 text-slate-700">30 jours après la décision de vérification</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-700">Logs d'erreurs (Sentry)</td>
                      <td className="px-4 py-3 text-slate-700">90 jours</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-700">Données de messagerie</td>
                      <td className="px-4 py-3 text-slate-700">Pendant la durée d'utilisation, suppression sur demande</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 5. Sous-traitants */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">5. Sous-traitants et prestataires</h2>
              <p className="mt-3">
                DogShift fait appel aux prestataires suivants dans le cadre de l'exploitation de la
                plateforme. Chacun traite vos données conformément à sa propre politique de confidentialité
                et selon des garanties contractuelles adéquates.
              </p>
              <div className="mt-4 space-y-3">
                {[
                  {
                    name: "Stripe",
                    role: "Traitement des paiements, virements aux sitters (Stripe Connect)",
                    location: "États-Unis / Union européenne",
                    link: "https://stripe.com/privacy",
                  },
                  {
                    name: "Vercel",
                    role: "Hébergement de l'application et des fonctions serverless",
                    location: "Union européenne (région par défaut)",
                    link: "https://vercel.com/legal/privacy-policy",
                  },
                  {
                    name: "Supabase / Neon (PostgreSQL)",
                    role: "Base de données principale",
                    location: "Union européenne",
                    link: null,
                  },
                  {
                    name: "Sentry",
                    role: "Monitoring des erreurs applicatives (logs anonymisés, PII filtrés avant envoi)",
                    location: "Union européenne (région DE)",
                    link: "https://sentry.io/privacy/",
                  },
                  {
                    name: "Cloudflare",
                    role: "Protection réseau, CDN, pare-feu applicatif",
                    location: "Union européenne",
                    link: "https://www.cloudflare.com/privacypolicy/",
                  },
                  {
                    name: "MapTiler",
                    role: "Affichage de la carte interactive (localisation des sitters)",
                    location: "Suisse / Union européenne",
                    link: "https://www.maptiler.com/privacy-policy/",
                  },
                  {
                    name: "Resend / SMTP",
                    role: "Envoi d'emails transactionnels (confirmations, notifications)",
                    location: "Union européenne",
                    link: "https://resend.com/privacy",
                  },
                  {
                    name: "Google Ads",
                    role: "Publicité en ligne (si applicable, selon consentement)",
                    location: "États-Unis",
                    link: "https://policies.google.com/privacy",
                  },
                ].map((p) => (
                  <div key={p.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {p.location}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600">{p.role}</p>
                    {p.link ? (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
                      >
                        Politique de confidentialité →
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            {/* 6. Droits des utilisateurs */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">6. Vos droits</h2>
              <p className="mt-3">
                Conformément à la nLPD suisse (et au RGPD pour les utilisateurs de l'UE), vous disposez
                des droits suivants sur vos données personnelles :
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    title: "Droit d'accès",
                    desc: "Obtenir une copie des données personnelles que nous détenons sur vous.",
                  },
                  {
                    title: "Droit de rectification",
                    desc: "Corriger vos informations depuis les paramètres de votre compte ou via support@dogshift.ch.",
                  },
                  {
                    title: "Droit à l'effacement",
                    desc: "Supprimer votre compte et vos données personnelles depuis les paramètres (Compte → Supprimer mon compte), sous réserve des obligations légales de conservation.",
                  },
                  {
                    title: "Droit à la portabilité",
                    desc: "Recevoir vos données dans un format structuré et lisible par machine. Demande à support@dogshift.ch.",
                  },
                  {
                    title: "Droit d'opposition",
                    desc: "Vous opposer au traitement fondé sur l'intérêt légitime (ex. communications marketing).",
                  },
                  {
                    title: "Droit de limitation",
                    desc: "Demander la suspension temporaire du traitement de vos données dans certaines circonstances.",
                  },
                ].map((r) => (
                  <div key={r.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900">{r.title}</p>
                    <p className="mt-1 text-slate-600">{r.desc}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4">
                Pour exercer vos droits, contactez-nous à{" "}
                <a href="mailto:support@dogshift.ch" className="text-slate-900 underline underline-offset-2">
                  support@dogshift.ch
                </a>
                . Nous répondons dans un délai de 30 jours.
              </p>
            </section>

            {/* 7. Cookies et traceurs */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">7. Cookies et traceurs</h2>
              <p className="mt-3">
                DogShift utilise des cookies et technologies similaires pour faire fonctionner la
                plateforme et, le cas échéant, mesurer l'audience et diffuser des publicités.
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Cookies essentiels</p>
                  <p className="mt-1 text-slate-600">
                    Nécessaires au fonctionnement de la plateforme : session utilisateur, session admin,
                    accès aux réservations. Ces cookies ne peuvent pas être refusés sans impacter
                    l'utilisation du service.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Cookies de performance (Sentry)</p>
                  <p className="mt-1 text-slate-600">
                    Utilisés pour capturer les erreurs techniques. Les données personnelles sont filtrées
                    avant envoi.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Cookies publicitaires (Google Ads)</p>
                  <p className="mt-1 text-slate-600">
                    Utilisés pour la mesure des conversions publicitaires. Soumis à consentement
                    conformément aux règles applicables.
                  </p>
                </div>
              </div>
            </section>

            {/* 8. Sécurité */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">8. Sécurité des données</h2>
              <p className="mt-3">
                DogShift met en œuvre des mesures techniques et organisationnelles appropriées pour
                protéger vos données : chiffrement des communications (HTTPS/TLS), chiffrement des secrets
                au repos, mots de passe utilisateurs stockés sous forme de hash bcrypt (jamais en clair),
                contrôle d'accès strict, protection réseau via Cloudflare, monitoring des erreurs avec
                filtrage des données personnelles, et validations côté serveur sur toutes les entrées.
              </p>
              <p className="mt-3">
                Si vous découvrez une faille de sécurité, vous pouvez nous la signaler de façon
                responsable à l'adresse{" "}
                <a href="mailto:support@dogshift.ch" className="text-slate-900 underline underline-offset-2">
                  support@dogshift.ch
                </a>{" "}
                (voir aussi{" "}
                <a
                  href="/.well-known/security.txt"
                  className="text-slate-900 underline underline-offset-2"
                >
                  security.txt
                </a>
                ).
              </p>
            </section>

            {/* 9. Vérification d'identité */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">9. Vérification d'identité (sitters)</h2>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="mt-2">
                  DogShift peut proposer aux dogsitters de soumettre, sur une base volontaire, une copie
                  d'une pièce d'identité et, le cas échéant, un selfie afin d'obtenir l'affichage d'un
                  badge « Profil vérifié ».
                </p>
                <p className="mt-3">
                  Ces données font l'objet d'une vérification manuelle visuelle de cohérence. Elles ne
                  sont jamais utilisées à des fins commerciales, marketing ou de profilage.
                </p>
                <p className="mt-3">
                  Les documents sont stockés dans un espace privé avec accès restreint via des liens
                  temporaires sécurisés (60 secondes). Ils sont supprimés au plus tard 30 jours après la
                  décision de vérification.
                </p>
              </div>
            </section>

            {/* 10. Accords de traitement (DPA) */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">10. Accords de traitement des données (DPA)</h2>
              <p className="mt-3">
                Conformément à la nLPD et au RGPD, DogShift a conclu ou adhère aux accords de traitement
                des données (Data Processing Agreements) proposés par chacun de ses sous-traitants. Ces
                accords garantissent que vos données sont traitées de façon sécurisée, uniquement pour les
                finalités définies, et dans le respect du cadre légal applicable.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    name: "Stripe",
                    role: "Traitement des paiements",
                    dpa: "https://stripe.com/legal/dpa",
                  },
                  {
                    name: "Sentry",
                    role: "Monitoring des erreurs (sans données personnelles)",
                    dpa: "https://sentry.io/legal/dpa/",
                  },
                  {
                    name: "Neon (PostgreSQL)",
                    role: "Base de données — hébergée en Europe (UE)",
                    dpa: "https://neon.tech/dpa",
                  },
                  {
                    name: "Vercel",
                    role: "Hébergement et déploiement de la plateforme",
                    dpa: "https://vercel.com/legal/dpa",
                  },
                ].map((p) => (
                  <div key={p.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    <p className="mt-1 text-slate-600 text-xs">{p.role}</p>
                    <a
                      href={p.dpa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
                    >
                      Voir le DPA →
                    </a>
                  </div>
                ))}
              </div>
            </section>

            {/* 11. Contact */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">11. Contact et réclamations</h2>
              <p className="mt-3">
                Pour toute question, exercice de droits ou réclamation relative à vos données personnelles :
              </p>
              <p className="mt-2">
                <a href="mailto:support@dogshift.ch" className="text-slate-900 underline underline-offset-2">
                  support@dogshift.ch
                </a>
              </p>
              <p className="mt-4">
                Si vous estimez que vos droits ne sont pas respectés, vous pouvez déposer une réclamation
                auprès du Préposé fédéral à la protection des données et à la transparence (PFPDT) en
                Suisse, ou de l'autorité de protection des données compétente dans votre pays de résidence
                (UE).
              </p>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
