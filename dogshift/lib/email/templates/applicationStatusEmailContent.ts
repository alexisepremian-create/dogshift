/**
 * Pure (non-JSX) helpers for ApplicationStatusEmail.
 *
 * Kept in a `.ts` file so the Node test runner (which uses
 * --experimental-strip-types and cannot load `.tsx`) can import them directly.
 *
 * The React Email component that renders the HTML lives in
 * ./applicationStatusEmail.tsx and re-exports these helpers.
 */

export type ApplicationStatusEmailStatus = "HIGH" | "REVIEW" | "LOW";

export function applicationStatusEmailSubject(status: ApplicationStatusEmailStatus): string {
  switch (status) {
    case "HIGH":
      return "🎉 Bienvenue chez DogShift — Réservons ton entretien";
    case "REVIEW":
      return "Ta candidature DogShift est à l'étude 🐾";
    case "LOW":
    default:
      return "Ta candidature DogShift";
  }
}

export function applicationStatusEmailDefaultPreviewText(
  status: ApplicationStatusEmailStatus
): string {
  switch (status) {
    case "HIGH":
      return "Ton profil est retenu — réserve ton entretien DogShift";
    case "REVIEW":
      return "Merci pour ta candidature — nous revenons vers toi sous 5 jours ouvrables";
    case "LOW":
    default:
      return "Nous avons bien étudié ta candidature DogShift";
  }
}

export function applicationStatusEmailPlainText(params: {
  firstName: string;
  lastName: string;
  status: ApplicationStatusEmailStatus;
  calendlyLink?: string;
}): string {
  const firstName = (params.firstName || "").trim();
  const greeting = `Bonjour${firstName ? ` ${firstName}` : ""},`;
  const signOff = "— L'équipe DogShift\n\nBesoin d'aide ? support@dogshift.ch";

  if (params.status === "HIGH") {
    const link = (params.calendlyLink || "").trim();
    return (
      `${greeting}\n\n` +
      `Excellente nouvelle : ton profil correspond parfaitement à ce que nous cherchons pour la phase pilote DogShift.\n\n` +
      `Pour valider ta candidature, nous organisons un court entretien de 15 minutes. C'est une étape obligatoire avant l'activation de ton profil.\n\n` +
      (link ? `Réserve ton créneau ici : ${link}\n\n` : "") +
      `À très vite,\n\n${signOff}\n`
    );
  }

  if (params.status === "REVIEW") {
    return (
      `${greeting}\n\n` +
      `Merci beaucoup pour ta candidature DogShift. Ton profil est intéressant et nous avons besoin d'un peu de temps pour l'examiner en détail avec l'équipe.\n\n` +
      `Nous reviendrons vers toi sous 5 jours ouvrables, soit pour organiser un entretien, soit avec un retour motivé.\n\n` +
      `Si tu souhaites compléter ta candidature avec des éléments supplémentaires (références, expériences, photos), réponds simplement à cet email.\n\n` +
      `${signOff}\n`
    );
  }

  return (
    `${greeting}\n\n` +
    `Merci beaucoup de l'intérêt que tu portes à DogShift et du temps que tu as consacré à ta candidature.\n\n` +
    `Nous sommes actuellement en phase pilote avec une sélection très restreinte de dog-sitters. À ce stade, nous ne pourrons malheureusement pas retenir ta candidature.\n\n` +
    `Rien n'est définitif : à mesure que la plateforme grandit, nous rouvrirons les candidatures et serons ravis de relire ton profil. N'hésite pas à recandidater plus tard.\n\n` +
    `${signOff}\n`
  );
}
