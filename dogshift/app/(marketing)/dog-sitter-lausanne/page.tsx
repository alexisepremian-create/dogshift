import type { Metadata } from "next";

import CitySeoLandingPage from "@/app/(marketing)/_components/CitySeoLandingPage";

const title = "Dog sitter Lausanne | Promenade, garde et pension chien | DogShift";
const description = "Trouvez un dog sitter à Lausanne fiable et vérifié. Promenade, garde et pension pour votre chien avec DogShift.";
const canonical = "https://dogshift.ch/dog-sitter-lausanne";

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

export default function DogSitterLausannePage() {
  return (
    <CitySeoLandingPage
      cityLabel="Lausanne"
      heroTitle="Trouver un dog sitter à Lausanne"
      heroSubtitle="Promenade, garde et pension pour votre chien avec des profils de confiance."
      introParagraphs={[
        "DogShift permet de trouver un dog sitter à Lausanne dans un cadre premium, simple et rassurant pour les propriétaires de chiens.",
        "Que vous recherchiez du dog-sitting Lausanne pour une promenade, une garde chien Lausanne à domicile ou une pension pour votre chien, DogShift met l’accent sur la confiance, la clarté et la qualité de service.",
        "Notre objectif est de faciliter la mise en relation avec des dogsitters vérifiés, capables d’offrir une expérience fiable, humaine et adaptée au rythme de votre chien à Lausanne et sur la Riviera.",
      ]}
      seoSections={[
        {
          title: "Dogsitting à Lausanne",
          paragraphs: [
            "DogShift développe une approche du dogsitting à Lausanne pensée pour les propriétaires qui recherchent une solution plus fiable, plus lisible et plus qualitative pour leur chien.",
            "En phase pilote sur la Riviera, nous préparons une expérience de dog sitter Lausanne centrée sur la confiance, la proximité et un service premium, sans compromis sur la clarté des profils.",
          ],
        },
        {
          title: "Garde de chien à Lausanne",
          paragraphs: [
            "Pour une garde de chien à Lausanne, DogShift vise à simplifier la recherche d’un profil de confiance pour les promenades, les gardes à domicile et les séjours plus longs.",
            "La plateforme met en avant des profils vérifiés afin d’offrir une expérience plus sereine aux propriétaires situés à Lausanne, Montreux et sur l’ensemble de la Riviera.",
          ],
        },
        {
          title: "Promenade de chien à Lausanne",
          paragraphs: [
            "DogShift a aussi vocation à faciliter la recherche d’un service de promenade de chien à Lausanne, avec une approche plus premium et mieux structurée du dog-sitting local.",
          ],
        },
      ]}
      structuredData={{
        "@context": "https://schema.org",
        "@type": "Service",
        name: "DogShift",
        areaServed: "Lausanne",
        serviceType: "dog sitting",
        provider: {
          "@type": "Organization",
          name: "DogShift",
          url: "https://dogshift.ch",
        },
        url: canonical,
      }}
      clarificationTitle="DogShift avance progressivement sur la Riviera"
      clarificationText="DogShift est actuellement en phase pilote sur la Riviera, entre Lausanne et Montreux, avec un nombre volontairement limité de profils afin de garantir un lancement sérieux, fluide et qualitatif."
      valueItems={[
        {
          title: "Profils vérifiés",
          description: "Chaque dogsitter admis sur DogShift fait l’objet d’une sélection attentive pour offrir un cadre plus fiable aux propriétaires.",
        },
        {
          title: "Plateforme sécurisée",
          description: "DogShift privilégie une expérience claire et sécurisée, avec un accompagnement pensé pour des réservations sereines.",
        },
        {
          title: "Expérience premium",
          description: "Une approche plus exigeante du dog-sitting à Lausanne, centrée sur la confiance, la qualité de service et la relation humaine.",
        },
      ]}
      ctaEyebrow="Accès prioritaire"
      ctaTitle="Préparez votre accès DogShift à Lausanne"
      ctaText="Inscrivez-vous pour suivre le lancement complet, découvrir les prochaines disponibilités et rejoindre DogShift dès les premières ouvertures de profils sur Lausanne et la Riviera."
      primaryCta={{ href: "/help", label: "Être notifié du lancement complet" }}
      secondaryCta={{ href: "/search", label: "Trouver un dogsitter" }}
      tertiaryCta={{ href: "/devenir-dogsitter", label: "Devenir dogsitter" }}
    />
  );
}
