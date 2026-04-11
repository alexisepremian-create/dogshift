import type { Metadata } from "next";

import CitySeoLandingPage from "@/app/(marketing)/_components/CitySeoLandingPage";

const title = "Dog sitter Morges | Dogsitting premium bientôt disponible | DogShift";
const description =
  "DogShift arrive bientôt à Morges. Profils vérifiés pour promenade, garde et pension de chien. Inscrivez-vous pour être informé du lancement dans votre région.";
const canonical = "https://www.dogshift.ch/dog-sitter-morges";

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

export default function DogSitterMorgesPage() {
  return (
    <CitySeoLandingPage
      cityLabel="Morges"
      heroTitle="Trouver un dog sitter à Morges"
      heroSubtitle="DogShift arrive bientôt à Morges. Inscrivez-vous pour accéder en priorité aux premiers profils vérifiés disponibles dans votre région."
      introParagraphs={[
        "DogShift prépare son arrivée à Morges avec la même exigence que sur la Riviera. Notre objectif est de proposer un service de dog-sitting à Morges fiable, premium et fondé sur des profils vérifiés manuellement.",
        "Que vous recherchiez un dog sitter à Morges pour une promenade régulière, une garde chien Morges à domicile ou une pension pour votre chien, DogShift sera bientôt la solution la plus sérieuse et la plus qualitative dans votre région.",
        "En attendant l'ouverture complète à Morges, vous pouvez rejoindre dès maintenant la liste d'attente pour être informé en priorité et accéder aux premiers profils disponibles dans votre secteur.",
      ]}
      seoSections={[
        {
          title: "Dog-sitting à Morges avec DogShift",
          paragraphs: [
            "DogShift développe une approche du dogsitting à Morges pensée pour les propriétaires qui cherchent une solution plus transparente, plus sécurisée et plus premium pour leur chien.",
            "Le service de dog sitter Morges sera déployé dans le prolongement du lancement réussi sur la Riviera. Les communes proches comme Tolochenaz, Échandens, Préverenges et Saint-Prex seront également couvertes progressivement.",
          ],
        },
        {
          title: "Garde de chien à Morges",
          paragraphs: [
            "Pour la garde de chien à Morges, DogShift proposera des profils pour des gardes ponctuelles, régulières ou longue durée. Chaque dogsitter sera sélectionné manuellement et devra disposer d'une assurance responsabilité civile valide.",
            "Si vous avez besoin d'un service de garde chien Morges dans l'immédiat, vous pouvez consulter les profils disponibles sur la Riviera ou nous contacter pour évaluer les options dans votre zone.",
          ],
        },
        {
          title: "Promenade de chien à Morges",
          paragraphs: [
            "La promenade de chien à Morges fait partie des services visés par DogShift lors de l'ouverture dans la région. Nos dogsitters proposeront des prestations adaptées au rythme de votre chien et à la géographie locale.",
          ],
        },
        {
          title: "Questions fréquentes — Dog sitter Morges",
          paragraphs: [
            "Quand DogShift sera-t-il disponible à Morges ? Le lancement à Morges s'inscrit dans le déploiement progressif de DogShift en Suisse romande. Inscrivez-vous pour être informé en priorité.",
            "Comment fonctionne DogShift ? Vous choisissez un service (promenade, garde, pension), renseignez votre ville et sélectionnez un profil vérifié disponible. La réservation est simple, transparente et sécurisée.",
            "Combien coûte un dog sitter à Morges ? Les tarifs seront affichés sur chaque profil lors du lancement, avec une grille claire et sans frais cachés.",
          ],
        },
      ]}
      structuredData={{
        "@context": "https://schema.org",
        "@type": "Service",
        name: "DogShift",
        areaServed: "Morges",
        serviceType: "dog sitting",
        provider: {
          "@type": "Organization",
          name: "DogShift",
          url: "https://dogshift.ch",
        },
        url: canonical,
      }}
      clarificationTitle="Morges arrive bientôt sur DogShift"
      clarificationText="DogShift est actuellement actif sur la Riviera vaudoise, entre Lausanne et Montreux, et se déploie progressivement en Suisse romande. Morges fait partie des prochaines villes couvertes. Rejoignez la liste d'attente pour être informé dès l'ouverture."
      ctaEyebrow="Bientôt disponible à Morges"
      ctaTitle="Soyez parmi les premiers informés à Morges"
      ctaText="Rejoignez la liste d'attente DogShift pour être informé du lancement à Morges, découvrir les premiers profils vérifiés disponibles et réserver dès les premières ouvertures dans votre région."
      primaryCta={{ href: "/help", label: "Être informé du lancement à Morges" }}
      secondaryCta={{ href: "/help", label: "Rejoindre la liste d'attente" }}
      tertiaryCta={{ href: "/devenir-dogsitter", label: "Devenir dogsitter à Morges" }}
    />
  );
}
