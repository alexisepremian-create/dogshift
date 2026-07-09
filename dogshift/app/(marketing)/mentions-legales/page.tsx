import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales de DogShift — éditeur, hébergeur et responsabilités.",
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 ds-legal-main">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.25)] sm:p-10 ds-legal-card">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl ds-legal-title">
            Mentions légales
          </h1>
          <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : avril 2025</p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-slate-700">

            {/* Éditeur */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">1. Éditeur du site</h2>
              <div className="mt-3 space-y-1">
                <p className="font-medium text-slate-900">DogShift</p>
                <p>Exploité en nom propre par Alexis Epremian</p>
                <p>Rue du lac 128</p>
                <p>1815 Clarens (Montreux)</p>
                <p>Suisse</p>
                <p className="pt-1">
                  <span className="font-medium text-slate-900">Email :</span>{" "}
                  <a href="mailto:support@dogshift.ch" className="underline underline-offset-2 hover:text-slate-900">
                    support@dogshift.ch
                  </a>
                </p>
              </div>
            </section>

            {/* Description du service */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">2. Description du service</h2>
              <p className="mt-3">
                DogShift est une plateforme de mise en relation entre propriétaires de chiens et
                dogsitters indépendants en Suisse, proposant des services de promenade, garde
                ou pension à domicile. La plateforme est accessible à l&apos;adresse{" "}
                <a href="https://www.dogshift.ch" className="underline underline-offset-2 hover:text-slate-900">
                  www.dogshift.ch
                </a>.
              </p>
            </section>

            {/* Hébergement */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">3. Hébergement</h2>
              <div className="mt-3 space-y-1">
                <p className="font-medium text-slate-900">Vercel Inc.</p>
                <p>440 N Barranca Ave #4133</p>
                <p>Covina, CA 91723</p>
                <p>États-Unis</p>
                <p className="pt-1">
                  <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-900">
                    vercel.com
                  </a>
                </p>
              </div>
              <p className="mt-3 text-slate-600">
                L&apos;infrastructure de base de données est hébergée en Europe (UE) via{" "}
                <span className="font-medium text-slate-700">Neon</span> (Allemagne) conformément
                aux exigences nLPD/RGPD.
              </p>
            </section>

            {/* Traitement des données */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">4. Protection des données</h2>
              <p className="mt-3">
                DogShift traite les données personnelles conformément à la{" "}
                <span className="font-medium text-slate-700">Loi fédérale sur la protection des données (nLPD)</span>{" "}
                et au{" "}
                <span className="font-medium text-slate-700">Règlement Général sur la Protection des Données (RGPD)</span>{" "}
                pour les utilisateurs européens.
              </p>
              <p className="mt-2">
                Pour toute demande relative à vos données (accès, rectification, effacement,
                portabilité), contactez-nous à{" "}
                <a href="mailto:support@dogshift.ch" className="underline underline-offset-2 hover:text-slate-900">
                  support@dogshift.ch
                </a>{" "}
                ou consultez notre{" "}
                <Link href="/confidentialite" className="underline underline-offset-2 hover:text-slate-900">
                  politique de confidentialité
                </Link>.
              </p>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">5. Cookies et traceurs</h2>
              <p className="mt-3">
                Le site utilise des cookies essentiels au bon fonctionnement de la plateforme
                (session, authentification, réservations). Avec votre consentement, des cookies
                publicitaires{" "}
                <span className="font-medium text-slate-700">(Google Ads – AW-18081650051)</span>{" "}
                sont également déposés afin de mesurer l&apos;efficacité de nos campagnes
                marketing. Vous pouvez retirer votre consentement à tout moment via la
                bannière cookies présente sur le site.
              </p>
            </section>

            {/* Propriété intellectuelle */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">6. Propriété intellectuelle</h2>
              <p className="mt-3">
                L&apos;ensemble des contenus présents sur le site (textes, images, logo, code)
                sont la propriété exclusive de DogShift / Alexis Epremian, sauf mention contraire.
                Toute reproduction ou diffusion sans autorisation préalable est interdite.
              </p>
            </section>

            {/* Responsabilité */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">7. Limitation de responsabilité</h2>
              <p className="mt-3">
                DogShift agit en tant qu&apos;intermédiaire de mise en relation et ne peut être
                tenu responsable des dommages découlant directement des prestations fournies
                par les dogsitters indépendants. Chaque dogsitter est responsable de ses
                propres actes dans le cadre des services qu&apos;il fournit.
              </p>
              <p className="mt-2">
                DogShift ne peut garantir une disponibilité ininterrompue du service et se
                réserve le droit de modifier ou d&apos;interrompre le service à tout moment
                sans préavis.
              </p>
            </section>

            {/* Droit applicable */}
            <section>
              <h2 className="text-base font-semibold text-slate-900">8. Droit applicable et for</h2>
              <p className="mt-3">
                Les présentes mentions légales sont régies par le droit suisse. En cas de
                litige, les tribunaux du canton de Vaud sont exclusivement compétents.
              </p>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
