export default function CguPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.25)] sm:p-10">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Conditions Générales d’Utilisation – DogShift
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Version en vigueur dès sa publication. En accédant à la plateforme DogShift, vous acceptez les présentes CGU.
          </p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-slate-700">
            <section>
              <h2 className="text-base font-semibold text-slate-900">1. Présentation de DogShift</h2>
              <p className="mt-3">
                DogShift est une plateforme digitale suisse de mise en relation entre des propriétaires de chiens (les « Propriétaires »)
                et des dogsitters indépendants (les « Dogsitters ») proposant des services de garde, promenade, visite à domicile ou pension
                (les « Services »).
              </p>
              <p className="mt-3">
                DogShift agit en qualité d’intermédiaire technique : la plateforme permet la découverte d’annonces, la mise en relation,
                la gestion de réservations et le traitement des paiements. DogShift n’est ni un prestataire de garde, ni un employeur des Dogsitters,
                ni une compagnie d’assurance.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">2. Champ d’application des CGU</h2>
              <p className="mt-3">
                Les présentes Conditions Générales d’Utilisation (CGU) régissent l’accès et l’utilisation de la plateforme DogShift,
                ainsi que les relations entre DogShift et les utilisateurs (Propriétaires et Dogsitters).
              </p>
              <p className="mt-3">
                Toute utilisation de la plateforme implique l’acceptation des présentes CGU. Si vous n’acceptez pas ces CGU, vous devez cesser
                d’utiliser DogShift.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">3. Accès à la plateforme et création de compte</h2>
              <p className="mt-3">
                L’accès à la plateforme peut nécessiter la création d’un compte. Les utilisateurs s’engagent à fournir des informations exactes,
                complètes et à jour, et à maintenir la confidentialité de leurs identifiants.
              </p>
              <p className="mt-3">
                L’utilisateur est responsable de toute activité réalisée depuis son compte. Il s’engage à signaler sans délai toute utilisation
                non autorisée de son compte.
              </p>
              <p className="mt-3">
                DogShift peut limiter l’accès à certaines fonctionnalités, demander des informations complémentaires ou refuser une inscription
                afin de protéger la plateforme et ses utilisateurs.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">4. Rôle de DogShift (intermédiaire uniquement)</h2>
              <p className="mt-3">
                DogShift fournit une infrastructure technique permettant la mise en relation entre Propriétaires et Dogsitters.
                DogShift n’intervient pas dans l’exécution des Services et n’est pas partie au contrat de prestation conclu entre un Propriétaire et un Dogsitter.
              </p>
              <p className="mt-3">
                Les utilisateurs comprennent et acceptent que DogShift n’exerce pas de contrôle permanent sur l’exécution des Services, et qu’il appartient
                aux parties de s’assurer de la compatibilité du Service avec leurs besoins et contraintes (horaires, lieu, conditions particulières, consignes).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">5. Obligations des propriétaires de chiens</h2>
              <p className="mt-3">Les Propriétaires s’engagent notamment à :</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Fournir des informations exactes sur le chien (comportement, état de santé, traitements, allergies, habitudes).</li>
                <li>Respecter les obligations légales en matière de détention d’animal (vaccinations, identification, réglementation cantonale/communale).</li>
                <li>Transmettre des consignes claires (alimentation, sortie, rappels, contacts d’urgence).</li>
                <li>S’assurer que le chien est apte à être confié et informer le Dogsitter de tout risque connu ou besoin particulier.</li>
                <li>Disposer, le cas échéant, d’une assurance adaptée à la détention d’un animal (selon la situation personnelle du Propriétaire).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">6. Obligations des dogsitters</h2>
              <p className="mt-3">Les Dogsitters s’engagent notamment à :</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Exercer leur activité de manière indépendante et assumer l’ensemble de leurs obligations légales, fiscales et sociales.</li>
                <li>
                  Disposer d’une assurance responsabilité civile (RC) personnelle valable en Suisse couvrant, de manière appropriée, les dommages pouvant
                  survenir dans le cadre de la garde d’animaux.
                </li>
                <li>Fournir des informations exactes et à jour sur leur profil (identité, disponibilités, expérience, services proposés, tarifs).</li>
                <li>Exécuter les Services avec soin, diligence et dans le respect des consignes convenues avec le Propriétaire.</li>
                <li>Refuser toute réservation si les conditions de sécurité ne sont pas réunies (consignes insuffisantes, chien agressif non déclaré, etc.).</li>
              </ul>
              <p className="mt-3">
                DogShift peut demander au Dogsitter de confirmer l’existence d’une assurance RC personnelle ou de fournir des justificatifs, à des fins de sécurité
                et de qualité.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">7. Réservations et paiements</h2>
              <p className="mt-3">
                Les réservations sont effectuées via la plateforme. Les paiements sont traités de manière sécurisée par un prestataire de paiement (Stripe).
                DogShift ne stocke pas les données complètes de cartes de paiement.
              </p>
              <p className="mt-3">
                Le prix du Service est fixé par le Dogsitter (sauf indication contraire). DogShift perçoit une commission (frais de service) sur les transactions
                réalisées via la plateforme. Les conditions tarifaires et les taux de commission peuvent être ajustés.
              </p>
              <p className="mt-3">
                Les utilisateurs s’engagent à ne pas contourner le système de paiement de la plateforme (paiement hors plateforme) lorsque la réservation a été initiée
                via DogShift, sauf accord écrit explicite de DogShift.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">8. Évolution du service</h2>
              <p className="mt-3">
                DogShift est proposé sous forme de produit en évolution (MVP) avec des fonctionnalités susceptibles d’évoluer.
                La plateforme peut connaître des limitations (zones couvertes, disponibilité, fonctionnalités), des changements d’interface,
                ou des interruptions temporaires.
              </p>
              <p className="mt-3">
                DogShift se réserve le droit de faire évoluer, suspendre ou interrompre tout ou partie du service, notamment pour des raisons techniques,
                de sécurité, de conformité ou d’amélioration produit.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">9. Assurance et responsabilité</h2>
              <p className="mt-3">
                DogShift ne fournit aucune assurance, garantie ou couverture pour les Services réalisés par les Dogsitters, ni pour les dommages pouvant survenir
                pendant ou à l’occasion d’un Service.
              </p>
              <p className="mt-3">
                Chaque utilisateur demeure seul responsable de ses actes, omissions, consignes et du respect de la législation applicable. Il appartient notamment
                aux Dogsitters de disposer de leur propre assurance RC.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">10. Limitation de responsabilité de DogShift</h2>
              <p className="mt-3">
                DogShift n’est pas responsable de l’exécution des Services, de la qualité des prestations, ni des interactions entre utilisateurs.
                DogShift ne peut être tenue responsable en cas de dommages directs ou indirects liés à la relation contractuelle entre un Propriétaire et un Dogsitter.
              </p>
              <p className="mt-3">
                Dans les limites admises par le droit suisse, la responsabilité de DogShift est limitée aux dommages résultant d’une faute grave ou intentionnelle
                de DogShift dans l’exécution de ses obligations techniques.
              </p>
              <p className="mt-3">
                DogShift n’assume aucune responsabilité en cas de litige entre utilisateurs (accident, blessure, dégradation, fugue, comportement du chien,
                désaccord sur les consignes ou le prix).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">11. Annulation, suspension et résiliation des comptes</h2>
              <p className="mt-3">
                Les utilisateurs peuvent cesser d’utiliser la plateforme à tout moment. DogShift peut suspendre ou supprimer un compte, avec ou sans préavis selon
                les circonstances, notamment en cas de :
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>non-respect des CGU ou des lois applicables ;</li>
                <li>comportement à risque ou dangereux (pour les chiens, les personnes, ou la communauté) ;</li>
                <li>informations fausses, trompeuses ou incomplètes ;</li>
                <li>soupçon de fraude, contournement des paiements, ou usage abusif de la plateforme ;</li>
                <li>incidents répétés ou signalements sérieux.</li>
              </ul>
              <p className="mt-3">
                DogShift peut également prendre des mesures de prévention (ex. limitations temporaires) afin de protéger les utilisateurs et la qualité du service.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">12. Propriété intellectuelle</h2>
              <p className="mt-3">
                La plateforme DogShift, sa marque, son design, ses contenus (textes, visuels, logos) et ses fonctionnalités sont protégés par le droit de la propriété
                intellectuelle. Toute reproduction, extraction ou utilisation non autorisée est interdite.
              </p>
              <p className="mt-3">
                Les utilisateurs conservent leurs droits sur les contenus qu’ils publient (ex. descriptions), mais concèdent à DogShift une licence non exclusive et
                gratuite pour les afficher sur la plateforme, uniquement aux fins de fonctionnement du service.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">13. Protection des données</h2>
              <p className="mt-3">
                DogShift traite des données personnelles dans le cadre de l’exécution du service. Les principes de protection des données applicables en Suisse sont
                respectés.
              </p>
              <p className="mt-3">
                Une politique de confidentialité dédiée précise les traitements (finalités, bases légales, durées, droits). Pour toute question relative à vos données,
                vous pouvez contacter DogShift.
              </p>


              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">13.1 Profil vérifié – Vérification d’identité (dogsitter)</p>
                <p className="mt-3">
                  DogShift peut proposer aux Dogsitters, sur une base volontaire, de soumettre une copie d’une pièce d’identité et, le cas échéant, un selfie, afin
                  d’obtenir l’affichage d’un badge « Profil vérifié ».
                </p>
                <p className="mt-3">
                  La vérification est effectuée manuellement par l’équipe DogShift au moyen d’un contrôle visuel de cohérence des documents fournis. DogShift ne
                  procède à aucune authentification biométrique, vérification auprès d’autorités publiques, analyse automatisée anti-fraude ou expertise documentaire.
                  La vérification ne constitue pas une certification officielle de l’identité au sens légal.
                </p>
                <p className="mt-3">
                  DogShift ne garantit pas l’authenticité, la validité juridique, l’exactitude ni l’absence de falsification des documents transmis. Le Dogsitter
                  reconnaît que des documents peuvent être falsifiés ou usurpés.
                </p>
                <p className="mt-3">
                  Dans toute la mesure permise par le droit suisse, et sous réserve des cas de dol ou de faute grave, DogShift décline toute responsabilité en cas de
                  fraude documentaire, usurpation d’identité, ou dommage lié à la confiance accordée au badge « Profil vérifié ».
                </p>
                <p className="mt-3">
                  Le traitement de ces données d’identité est fondé sur l’exécution du contrat d’utilisation de la plateforme et sur l’intérêt légitime de DogShift à
                  assurer la sécurité, la confiance et la prévention des abus sur la plateforme. Les documents d’identité ne sont jamais utilisés à des fins commerciales,
                  marketing, de prospection, ni de profilage.
                </p>
                <p className="mt-3">
                  Les documents sont stockés de manière sécurisée dans un espace privé et ne sont accessibles que par des personnes autorisées au sein de DogShift, le
                  cas échéant via des liens temporaires sécurisés.
                </p>
                <p className="mt-3">
                  Sauf obligation légale, prévention de la fraude ou gestion d’un litige, DogShift supprime définitivement les documents au plus tard trente (30)
                  jours après la décision de vérification (approbation ou refus).
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">14. Modification des CGU</h2>
              <p className="mt-3">
                DogShift peut modifier les présentes CGU à tout moment, notamment pour tenir compte d’évolutions légales, techniques, ou du service.
                La version applicable est celle publiée sur la plateforme à la date de consultation.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900">15. Droit applicable et for juridique</h2>
              <p className="mt-3">
                Les présentes CGU sont régies par le droit suisse. Sous réserve de dispositions impératives, le for juridique est situé en Suisse, au siège de DogShift.
              </p>
            </section>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-900">Note importante</p>
              <p className="mt-2 text-sm text-slate-700">
                Ces Conditions Générales d’Utilisation sont adaptées à un produit en évolution (MVP) et sont susceptibles d’évoluer à mesure que DogShift déploie de
                nouvelles fonctionnalités et élargit son activité.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
