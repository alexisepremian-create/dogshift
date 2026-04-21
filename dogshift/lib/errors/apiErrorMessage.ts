/**
 * Maps generic API error codes to French user-facing messages.
 *
 * Used by pages/components that surface API error codes to users — previously
 * some places leaked raw codes like "SAVE_ERROR", "PRICING_REQUIRED", etc.,
 * which is both ugly and in English.
 *
 * Add a code here whenever a new API route starts returning it to users.
 */

const API_CODE_TO_FR: Record<string, string> = {
  // Generic
  SAVE_ERROR: "Impossible d'enregistrer la modification. Réessaie dans un instant.",
  DELETE_ERROR: "Impossible de supprimer. Réessaie dans un instant.",
  RESET_ERROR: "Impossible de réinitialiser. Réessaie dans un instant.",
  FETCH_FAILED: "Impossible de récupérer les données. Vérifie ta connexion puis réessaie.",
  NETWORK_ERROR: "Problème de connexion réseau. Vérifie ta connexion puis réessaie.",
  TIMEOUT: "La requête a pris trop de temps. Réessaie dans un instant.",
  UNKNOWN: "Une erreur est survenue. Réessaie dans un instant.",
  ERROR: "Une erreur est survenue. Réessaie dans un instant.",
  INTERNAL_ERROR: "Erreur interne. Nos équipes ont été prévenues — réessaie dans un instant.",
  UPSTREAM_ERROR: "Un service tiers est temporairement indisponible. Réessaie dans un instant.",

  // Auth / session
  UNAUTHORIZED: "Connexion requise. Reconnecte-toi pour continuer.",
  FORBIDDEN: "Accès refusé.",
  NOT_FOUND: "Introuvable.",
  VALIDATION_ERROR: "Certaines informations saisies ne sont pas valides.",
  CONFLICT: "Cette action entre en conflit avec un autre changement. Rafraîchis la page puis réessaie.",
  RATE_LIMITED: "Trop de tentatives. Patiente un instant avant de réessayer.",
  SIGN_OUT_FAILED: "La déconnexion n'a pas abouti. Recharge la page.",
  FETCH_FAILED_AUTH: "Impossible de vérifier ta session. Reconnecte-toi.",

  // Availability / pricing
  PRICING_REQUIRED:
    "Tu dois d'abord définir un tarif pour ce service avant de pouvoir l'activer ou ajouter des disponibilités. Tu peux le faire dans la section Services & tarifs.",
  SERVICE_NOT_CONFIGURED: "Ce service n'est pas configuré pour ton profil.",
  SLOT_CONFLICT: "Ce créneau chevauche une autre règle. Ajuste les horaires.",
  OUT_OF_RANGE: "La valeur saisie est hors de la plage autorisée.",

  // Bookings / payments
  BOOKING_NOT_AVAILABLE: "Ce créneau vient d'être réservé ou n'est plus disponible.",
  BOOKING_NOT_FOUND: "Réservation introuvable.",
  BOOKING_TOO_SOON: "Les réservations doivent être effectuées au minimum 30 minutes à l'avance.",
  PAYMENT_FAILED: "Le paiement n'a pas abouti. Réessaie ou change de moyen de paiement.",
  STRIPE_CONFIG_MISSING: "La configuration de paiement est temporairement indisponible. Réessaie dans un instant.",

  // Files / uploads
  FILE_TOO_LARGE: "Le fichier est trop volumineux.",
  INVALID_FILE_TYPE: "Type de fichier non pris en charge.",
  UPLOAD_FAILED: "L'envoi du fichier a échoué. Réessaie.",

  // Invite codes
  CODE_REQUIRED: "Merci d'entrer un code d'invitation.",
  CODE_EXPIRED: "Ce code a expiré.",
  CODE_ALREADY_USED: "Ce code a déjà été utilisé.",
  CODE_INVALID: "Code invalide.",
};

/**
 * Returns a French user-facing message for an API error code.
 * If the code is unknown, returns either `fallback` or — if the code looks
 * like a human sentence already (has spaces/lowercase) — the code itself.
 */
export function apiErrorMessage(
  code: string | null | undefined,
  fallback = "Une erreur est survenue. Réessaie dans un instant.",
): string {
  if (!code) return fallback;
  const trimmed = code.trim();
  if (!trimmed) return fallback;

  const direct = API_CODE_TO_FR[trimmed] ?? API_CODE_TO_FR[trimmed.toUpperCase()];
  if (direct) return direct;

  // Heuristic: if the string looks like ALL_CAPS_UNDERSCORE or snake_case
  // (i.e. a raw code), use the generic fallback instead of leaking it.
  if (/^[A-Z][A-Z0-9_]+$/.test(trimmed)) {
    return fallback;
  }

  // Otherwise assume it's already a human message (e.g. French from API).
  return trimmed;
}
