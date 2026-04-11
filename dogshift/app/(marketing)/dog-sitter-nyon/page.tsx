import type { Metadata } from "next";

import CitySeoLandingPage from "@/app/(marketing)/_components/CitySeoLandingPage";

const title = "Dog sitter Nyon | Dogsitting premium bientôt disponible | DogShift";
const description =
  "DogShift arrive bientôt à Nyon. Profils vérifiés pour promenade, garde et pension de chien. Inscrivez-vous pour être informé du lancement.";
const canonical = "https://www.dogshift.ch/dog-sitter-nyon";

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

export default function DogSitterNyonPage() {
  return (
    <CitySeoLandingPage
      cityLabel="Nyon"
      heroTitle="Trouver un dog sitter à Nyon"
      heroSubtitle="DogShift arrive bientôt à Nyon. Inscrivez-vous pour accéder en priorité aux premiers profils vérifiés disponibles dans votre région."
      introParagraphs={[
        "DogShift prépare son déploiement à Nyon avec la même exigence que sur la Riviera. Notre ambition est de proposer un service de dog-sitting à Nyon fondé sur des profils vérifiés manuellement, un cadre contractuel clair et une expérience premium pour les propriétaires.",
        "Si vous recherchez un dog sitter à Nyon pour de la promenade, une garde chien Nyon à domicile ou une pension, DogShift sera bientôt la solution la plus fiable et la plus qualitative dans votre région.",
        "En attendant l'ouverture complète à Nyon, rejoignez dès maintenant la liste d'attente pour être parmi les premiers informés et accéder aux premiers profils disponibles dans votre secteur.",
      ]}
      seoSections={[
        {
          title: "Dog-sitting à Nyon avec DogShift",
          paragraphs: [
            "DogShift développe un service de dog-sitting à Nyon pensé pour les propriétaires qui recherchent une solution plus sérieuse, plus transparente et plus premium pour la garde de leur chien.",
            "Notre approche du dog sitter Nyon repose sur une sélection manuelle des profils, une vérification des antécédents et un accompagnement pensé pour des réservations sereines. Le lancement à Nyon s'inscrit dans le déploiement progressif de DogShift en Suisse romande.",
          ],
        },
        {
          title: "Garde de chien à Nyon",
          paragraphs: [
            "Pour la garde de chien à Nyon, DogShift proposera à terme des profils disponibles pour des gardes ponctuelles, régulières ou de longue durée. Les communes proches comme Prangins, Coppet, Gland et Rolle seront également couvertes progressivement.",
            "Si vous avez besoin d'un service de garde chien Nyon dans l'attente du lancement complet, vous pouvez consulter les profils disponibles sur la Riviera ou nous contacter directement.",
          ],
        },
        {
          title: "Promenade de chien à Nyon",
          paragraphs: [
            "La promenade de chien à Nyon sera l'un des premiers services disponibles lors du lancement DogShift dans la région. Nos dogsitters auront une bonne connaissance du territoire local et proposeront des prestations adaptées.",
          ],
        },
        {
          title: "Questions fréquentes — Dog sitter Nyon",
          paragraphs: [
            "Quand DogShift sera-t-il disponible à Nyon ? Le lancement à Nyon est prévu dans le cadre du déploiement progressif de DogShift en Suisse romande. Inscrivez-vous pour être informé en priorité.",
            "Comment fonctionne DogShift ? Vous sélectionnez un service (promenade, garde, pension), renseignez votre lieu et choisissez un profil vérifié disponible. La réservation est simple, claire et sécurisée.",
            "Combien coûte un dog sitter à Nyon ? Les tarifs seront affichés directement sur les profils lors du lancement. DogShift garantit une transparence totale sans frais cachés.",
          ],
        },
      ]}
      structuredData={{
        "@context": "https://schema.org",
        "@type": "Service",
        name: "DogShift",
        areaServed: "Nyon",
        serviceType: "dog sitting",
        provider: {
          "@type": "Organization",
          name: "DogShift",
          url: "https://dogshift.ch",
        },
        url: canonical,
      }}
      clarificationTitle="Nyon arrive bientôt sur DogShift"
      clarificationText="DogShift est actuellement actif sur la Riviera vaudoise, entre Lausanne et Montreux, et se déploie progressivement en Suisse romande. Nyon fait partie des prochaines villes ouvertes. Inscrivez-vous pour être informé dès l'ouverture dans votre région."
      ctaEyebrow="Bientôt disponible à Nyon"
      ctaTitle="Soyez parmi les premiers informés à Nyon"
      ctaText="Rejoignez la liste d'attente DogShift pour être informé du lancement à Nyon, découvrir les premiers profils disponibles et accéder aux premières ouvertures dans votre région avant tout le monde."
      primaryCta={{ href: "/help", label: "Être informé du lancement à Nyon" }}
      secondaryCta={{ href: "/help", label: "Rejoindre la liste d'attente" }}
      tertiaryCta={{ href: "/devenir-dogsitter", label: "Devenir dogsitter à Nyon" }}
    />
  );
}
