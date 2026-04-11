import type { Metadata } from "next";

import CitySeoLandingPage from "@/app/(marketing)/_components/CitySeoLandingPage";

const title = "Dog sitter Vevey | Promenade, garde, pension chien | DogShift";
const description =
  "Trouvez un dog sitter à Vevey avec DogShift. Profils vérifiés pour promenade, garde et pension de chien. Service en cours de déploiement sur Vevey et la Riviera.";
const canonical = "https://www.dogshift.ch/dog-sitter-vevey";

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

export default function DogSitterVeveyPage() {
  return (
    <CitySeoLandingPage
      cityLabel="Vevey"
      heroTitle="Trouver un dog sitter à Vevey"
      heroSubtitle="DogShift s'étend progressivement sur Vevey. Découvrez les premiers profils vérifiés disponibles sur la Riviera."
      introParagraphs={[
        "DogShift est une plateforme de dog-sitting premium qui connecte les propriétaires de chiens avec des profils vérifiés, sélectionnés avec soin. Le service est actif entre Lausanne et Montreux, et s'étend progressivement vers Vevey.",
        "Si vous recherchez un dog sitter à Vevey pour de la promenade, une garde chien Vevey à domicile ou une pension, DogShift est la référence premium en Suisse romande — avec une sélection rigoureuse des dogsitters présents sur la plateforme.",
        "Pour les résidents de Vevey et des communes environnantes (Corseaux, Saint-Légier, La Tour-de-Peilz), DogShift sera pleinement opérationnel très prochainement. Inscrivez-vous pour être informé dès l'ouverture complète dans votre secteur.",
      ]}
      seoSections={[
        {
          title: "Dog-sitting à Vevey avec DogShift",
          paragraphs: [
            "DogShift étend son service de dog-sitting à Vevey en continuité du déploiement déjà actif entre Lausanne et Montreux. Notre approche du dog sitter Vevey repose sur une sélection manuelle des profils, une vérification sérieuse des antécédents et un cadre contractuel clair.",
            "Vevey bénéficie d'une situation idéale sur la Riviera vaudoise. Les dogsitters DogShift actifs dans la région peuvent prendre en charge des chiens résidant à Vevey dès aujourd'hui selon la disponibilité des profils.",
          ],
        },
        {
          title: "Garde de chien à Vevey",
          paragraphs: [
            "La garde de chien à Vevey peut être organisée via DogShift pour des gardes à domicile, des visites de jour ou des séjours plus longs. Nos profils sont habitués aux différentes races et tempéraments, et chaque réservation bénéficie d'un cadre contractuel sécurisé.",
            "Pour trouver un service de garde chien Vevey adapté à votre situation, renseignez votre lieu et le service souhaité sur DogShift pour voir les disponibilités actuelles.",
          ],
        },
        {
          title: "Promenade de chien à Vevey",
          paragraphs: [
            "Le service de promenade de chien à Vevey fait partie des prestations proposées via DogShift. Nos dogsitters assurent des promenades régulières ou ponctuelles, adaptées au rythme et aux besoins de votre chien à Vevey et dans les communes proches.",
          ],
        },
        {
          title: "Questions fréquentes — Dog sitter Vevey",
          paragraphs: [
            "Combien coûte un dog sitter à Vevey ? Les tarifs varient selon le service et la durée. DogShift propose une grille tarifaire transparente, visible directement sur les profils.",
            "Comment fonctionne DogShift à Vevey ? Vous renseignez votre service (promenade, garde, pension), votre ville, et DogShift vous présente les profils disponibles. La réservation est ensuite simple et sécurisée.",
            "Le service est-il disponible maintenant à Vevey ? Oui, progressivement. Des profils actifs sur la Riviera peuvent couvrir Vevey. Cherchez sur la carte pour voir les disponibilités actuelles.",
          ],
        },
      ]}
      structuredData={{
        "@context": "https://schema.org",
        "@type": "Service",
        name: "DogShift",
        areaServed: "Vevey",
        serviceType: "dog sitting",
        provider: {
          "@type": "Organization",
          name: "DogShift",
          url: "https://dogshift.ch",
        },
        url: canonical,
      }}
      clarificationTitle="DogShift se déploie progressivement sur Vevey"
      clarificationText="DogShift est actif entre Lausanne et Montreux et couvre progressivement Vevey. Des profils disponibles sur la Riviera peuvent prendre en charge votre chien à Vevey dès maintenant. Le service sera pleinement opérationnel dans votre secteur très prochainement."
      valueItems={[
        {
          title: "Profils vérifiés",
          description:
            "Chaque dogsitter admis sur DogShift est sélectionné manuellement, avec vérification des antécédents pour une garde sereine.",
        },
        {
          title: "Casier judiciaire vérifié",
          description:
            "La sécurité de votre chien est notre priorité. Tous les profils DogShift passent par une vérification sérieuse avant activation.",
        },
        {
          title: "Assurance RC incluse",
          description:
            "Les dogsitters présents sur DogShift disposent d'une assurance responsabilité civile couvrant la garde d'animaux.",
        },
      ]}
      ctaEyebrow="Service disponible sur la Riviera"
      ctaTitle="Trouvez un dog sitter près de Vevey dès maintenant"
      ctaText="DogShift est actif sur la Riviera. Profitez des profils vérifiés disponibles près de chez vous, ou inscrivez-vous pour être informé des nouvelles disponibilités à Vevey."
      primaryCta={{ href: "/search", label: "Trouver un dog sitter" }}
      secondaryCta={{ href: "/help", label: "Être informé des nouveautés" }}
      tertiaryCta={{ href: "/devenir-dogsitter", label: "Devenir dogsitter à Vevey" }}
    />
  );
}
