import { renderEmailLayout } from "./layout";

/**
 * Email sent automatically after a lead magnet email capture.
 * Links to the /guide-dogsitter page (no binary PDF needed).
 */
export function renderLeadMagnetEmail(params: { baseUrl: string }) {
  const baseUrl = (params.baseUrl || "").trim().replace(/\/$/, "") || "https://dogshift.ch";
  const guideUrl = `${baseUrl}/guide-dogsitter`;
  const sitterUrl = `${baseUrl}/search`;

  const { html } = renderEmailLayout({
    title: "Votre guide gratuit est prêt 🐕",
    subtitle:
      "Les 5 erreurs à éviter quand vous confiez votre chien — conseils d'experts DogShift.",
    summaryTitle: "Ce que vous allez découvrir",
    summaryRows: [
      { label: "Erreur #1", value: "Ne pas vérifier les références du dog-sitter" },
      { label: "Erreur #2", value: "Choisir uniquement sur le prix" },
      { label: "Erreur #3", value: "Sauter la rencontre préalable chien/sitter" },
      { label: "Erreur #4", value: "Oublier de partager les infos médicales" },
      { label: "Erreur #5", value: "Ne pas définir les routines et attentes" },
    ],
    ctaLabel: "Lire le guide complet →",
    ctaUrl: guideUrl,
    secondaryLinkLabel: "Trouver un dog-sitter vérifié sur DogShift",
    secondaryLinkUrl: sitterUrl,
    footerText:
      "Vous recevez cet email car vous avez demandé notre guide gratuit sur dogshift.ch. " +
      "DogShift • support@dogshift.ch",
    footerLinks: [
      { label: "dogshift.ch", url: baseUrl },
      { label: "Se désabonner", url: `${baseUrl}/unsubscribe` },
    ],
  });

  const text =
    `Votre guide gratuit DogShift est prêt !\n\n` +
    `Les 5 erreurs à éviter quand vous confiez votre chien :\n\n` +
    `1. Ne pas vérifier les références du dog-sitter\n` +
    `2. Choisir uniquement sur le prix\n` +
    `3. Sauter la rencontre préalable chien/sitter\n` +
    `4. Oublier de partager les informations médicales\n` +
    `5. Ne pas définir clairement les routines et attentes\n\n` +
    `Lire le guide complet : ${guideUrl}\n\n` +
    `— L'équipe DogShift\n` +
    `support@dogshift.ch | ${baseUrl}\n`;

  return { html, text };
}
