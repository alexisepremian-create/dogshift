import Link from "next/link";
import type { Metadata } from "next";

import HomePageClient from "./HomePageClient";

const homepageTitle = "DogShift – Dog-sitting premium en Suisse";
const homepageDescription = "DogShift est une plateforme de dog-sitting premium en Suisse. Trouvez un dog-sitter de confiance pour promenade, garde ou pension.";
const homepageUrl = "https://www.dogshift.ch";

export const metadata: Metadata = {
  title: homepageTitle,
  description: homepageDescription,
  alternates: {
    canonical: homepageUrl,
  },
  openGraph: {
    type: "website",
    url: homepageUrl,
    title: homepageTitle,
    description: homepageDescription,
    siteName: "DogShift",
    locale: "fr_CH",
  },
  twitter: {
    card: "summary_large_image",
    title: homepageTitle,
    description: homepageDescription,
  },
};

export default function Home() {
  return (
    <>
      <HomePageClient />
      <section className="bg-slate-50 pb-16 pt-14 sm:pb-20 sm:pt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Dog-sitting en Suisse avec DogShift
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              <p>
                DogShift est une plateforme de dog-sitting en Suisse qui permet de trouver facilement un dog sitter de confiance.
              </p>
              <p>
                Que vous recherchiez une promenade de chien, une garde à domicile ou une pension pour votre chien, DogShift met en relation les
                propriétaires avec des dogsitters vérifiés.
              </p>
              <p>
                Disponible à Lausanne, Genève et dans toute la Suisse, DogShift vous permet de trouver rapidement un service de garde pour chien
                adapté à vos besoins, notamment pour trouver un dog sitter à Lausanne et dans votre région.
              </p>
              <p>
                Nos dogsitters proposent différents services : promenade quotidienne, garde à domicile, pension longue durée et visites à domicile.
              </p>
              <p>
                Grâce à un processus de sélection rigoureux et des profils vérifiés, DogShift garantit une expérience fiable, sécurisée et
                transparente.
              </p>
              <p>
                Vous recherchez un <Link href="/dog-sitter-lausanne" className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900">dog sitter à Lausanne</Link> ou un{" "}
                <Link href="/dog-sitter-geneve" className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900">dog sitter à Genève</Link> ? Découvrez nos services disponibles dans votre région.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}