import type { Metadata } from "next";

import CitySeoLandingPage from "@/app/(marketing)/_components/CitySeoLandingPage";

const title = "Dog sitter Montreux | Promenade, garde et pension chien | DogShift";
const description =
  "Trouvez un dog sitter à Montreux avec DogShift. Profils vérifiés, assurance incluse. Promenade, garde et pension pour votre chien sur la Riviera.";
const canonical = "https://www.dogshift.ch/dog-sitter-montreux";

export const metadata: Metadata = {
  title,
  description,
  robots: { index: true, follow: true },
  alternates: { canonical },
  openGraph: {
    title,
    description,
    url: canonical,
    type: "website",
    locale: "fr_CH",
    siteName: "DogShift",
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function DogSitterMontreuxPage() {
  return (
    <CitySeoLandingPage
      cityLabel="Montreux"
      heroTitle="Trouver un dog sitter à Montreux"
      heroSubtitle="Promenade, garde et pension pour votre chien avec des profils vérifiés sur la Riviera. DogShift est disponible à Montreux."
      introParagraphs={[
        "DogShift est actif à Montreux et sur l'ensemble de la Riviera vaudoise. Notre plateforme vous permet de trouver un dog sitter à Montreux avec des profils vérifiés manuellement, sélectionnés pour leur sérieux et leur expérience avec les animaux.",
        "Que vous cherchiez un service de promenade chien Montreux, une garde à domicile ou une pension pour votre chien, DogShift propose une expérience de dog-sitting Montreux centrée sur la confiance, la clarté et la qualité.",
        "Chaque dogsitter présent sur DogShift à Montreux est vérifié, assuré et s'engage dans un cadre contractuel clair. Vous pouvez réserver en toute sérénité, dès aujourd'hui.",
      ]}
      seoSections={[
        {
          title: "Dog-sitting à Montreux avec DogShift",
          paragraphs: [
            "DogShift propose un service de dog-sitting à Montreux fondé sur des principes simples : des profils vérifiés, des échanges transparents et une expérience premium du début à la fin. Notre approche du dog sitter Montreux place la confiance au cœur de chaque réservation.",
            "Montreux est l'une des villes pilotes de DogShift sur la Riviera. Nous y maintenons un nombre volontairement maîtrisé de dogsitters afin de garantir un niveau de qualité élevé et cohérent pour chaque propriétaire.",
          ],
        },
        {
          title: "Garde de chien à Montreux",
          paragraphs: [
            "La garde de chien à Montreux est disponible via DogShift pour des gardes ponctuelles, régulières ou longue durée. Chaque profil indique ses disponibilités, ses tarifs et son expérience, pour une mise en relation simple et fiable.",
            "Que vous habitiez Montreux, Clarens, Territet ou Glion, DogShift vous permet de trouver un dogsitter adapté à votre chien et à votre rythme.",
          ],
        },
        {
          title: "Promenade de chien à Montreux",
          paragraphs: [
            "DogShift facilite la recherche d'un service de promenade de chien à Montreux avec des profils actifs disponibles à la réservation. Nos dogsitters connaissent les itinéraires locaux et s'adaptent aux besoins de votre animal.",
          ],
        },
        {
          title: "Questions fréquentes — Dog sitter Montreux",
          paragraphs: [
            "Combien coûte un dog sitter à Montreux ? Les tarifs sont affichés directement sur les profils. DogShift garantit une transparence totale sans frais cachés.",
            "Comment réserver un dogsitter à Montreux via DogShift ? Sélectionnez le service souhaité (promenade, garde, pension), renseignez Montreux comme lieu de prise en charge, et choisissez un profil disponible.",
            "Les dogsitters à Montreux sont-ils vérifiés ? Oui. Chaque dogsitter DogShift à Montreux est sélectionné manuellement, avec vérification des antécédents et assurance RC obligatoire.",
          ],
        },
      ]}
      structuredData={{
        "@context": "https://schema.org",
        "@type": "Service",
        name: "DogShift",
        areaServed: "Montreux",
        serviceType: "dog sitting",
        provider: {
          "@type": "Organization",
          name: "DogShift",
          url: "https://dogshift.ch",
        },
        url: canonical,
      }}
      clarificationTitle="DogShift est actif à Montreux"
      clarificationText="DogShift est disponible à Montreux dès maintenant, avec des profils vérifiés prêts à accueillir votre chien. Nous maintenons un lancement progressif et maîtrisé pour garantir un niveau de qualité premium à chaque réservation."
      valueItems={[
        {
          title: "Profils vérifiés manuellement",
          description:
            "Chaque dogsitter à Montreux est sélectionné après un processus de vérification rigoureux. Aucun profil non validé n'est visible sur la plateforme.",
        },
        {
          title: "Casier judiciaire vérifié",
          description:
            "La sécurité de votre chien est notre priorité. Tous les profils DogShift à Montreux sont vérifiés avant d'être activés sur la plateforme.",
        },
        {
          title: "Assurance RC incluse",
          description:
            "Les dogsitters DogShift à Montreux disposent d'une assurance responsabilité civile valide, couvrant la garde d'animaux.",
        },
      ]}
      ctaEyebrow="Service disponible à Montreux"
      ctaTitle="Trouvez un dog sitter à Montreux dès aujourd'hui"
      ctaText="DogShift est actif à Montreux. Parcourez les profils vérifiés disponibles, choisissez le dogsitter qui correspond à votre chien et réservez en toute confiance."
      primaryCta={{ href: "/search", label: "Trouver un dog sitter à Montreux" }}
      secondaryCta={{ href: "/devenir-dogsitter", label: "Devenir dogsitter" }}
      tertiaryCta={{ href: "/help", label: "Nous contacter" }}
    />
  );
}
