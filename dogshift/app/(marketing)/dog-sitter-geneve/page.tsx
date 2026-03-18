import type { Metadata } from "next";

import CitySeoLandingPage from "@/app/(marketing)/_components/CitySeoLandingPage";

const title = "Dog sitter Genève | Dogsitting premium en Suisse | DogShift";
const description = "Trouvez bientôt un dog sitter à Genève avec DogShift. Plateforme premium de dogsitting en Suisse.";
const canonical = "https://dogshift.ch/dog-sitter-geneve";

export const metadata: Metadata = {
  title,
  description,
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical,
  },
  openGraph: {
    title,
    description,
    url: canonical,
    type: "website",
    locale: "fr_CH",
    siteName: "DogShift",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function DogSitterGenevePage() {
  return (
    <CitySeoLandingPage
      cityLabel="Genève"
      heroTitle="Trouver un dog sitter à Genève"
      heroSubtitle="DogShift arrive bientôt à Genève."
      introParagraphs={[
        "DogShift prépare son arrivée pour permettre de trouver un dog sitter à Genève avec une approche premium, claire et rassurante.",
        "Pour les besoins de promenade, de garde chien Genève, de pension ou de visites à domicile, notre ambition est de proposer une expérience de dog-sitting Genève fondée sur la confiance et la sélection rigoureuse des profils.",
        "Si vous cherchez déjà une solution de garde pour chien à Genève, vous pouvez rejoindre dès maintenant la liste d’attente DogShift afin d’être informé des prochaines ouvertures dans votre ville.",
      ]}
      seoSections={[
        {
          title: "Dogsitting à Genève",
          paragraphs: [
            "DogShift prépare une offre de dogsitting à Genève conçue pour les propriétaires qui recherchent un cadre plus premium, plus fiable et plus transparent.",
            "Notre ambition est d’ouvrir progressivement la ville avec une approche de dog sitter Genève axée sur la confiance, la qualité des profils et une expérience plus sereine.",
          ],
        },
        {
          title: "Garde de chien à Genève",
          paragraphs: [
            "Pour la garde de chien à Genève, DogShift proposera à terme une plateforme claire permettant d’identifier plus facilement un dogsitter adapté à votre rythme et aux besoins de votre chien.",
          ],
        },
        {
          title: "Promenade de chien à Genève",
          paragraphs: [
            "La promenade de chien à Genève fera également partie des services visés par DogShift, avec une ouverture progressive et un haut niveau d’exigence sur les profils intégrés.",
          ],
        },
      ]}
      structuredData={{
        "@context": "https://schema.org",
        "@type": "Service",
        name: "DogShift",
        areaServed: "Genève",
        serviceType: "dog sitting",
        provider: {
          "@type": "Organization",
          name: "DogShift",
          url: "https://dogshift.ch",
        },
        url: canonical,
      }}
      clarificationTitle="Genève arrive bientôt sur DogShift"
      clarificationText="DogShift est actuellement disponible sur la Riviera, entre Lausanne et Montreux, et s’étendra prochainement à Genève. Nous ouvrons la ville progressivement pour préserver une qualité de service élevée dès le lancement."
      ctaEyebrow="Bientôt à Genève"
      ctaTitle="Soyez parmi les premiers informés à Genève"
      ctaText="Rejoignez la liste d’attente DogShift pour être informé du lancement à Genève, découvrir les premières ouvertures et suivre l’arrivée progressive de nos services dans votre région."
      primaryCta={{ href: "/help", label: "Être informé du lancement à Genève" }}
      secondaryCta={{ href: "/help", label: "Rejoindre la liste d’attente" }}
      tertiaryCta={{ href: "/devenir-dogsitter", label: "Devenir dogsitter à Genève" }}
    />
  );
}
