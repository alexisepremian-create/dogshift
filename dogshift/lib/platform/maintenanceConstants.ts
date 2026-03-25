export const PLATFORM_SETTINGS_GLOBAL_ID = "global";

/** Bandeau global + corps des réponses API 503 par défaut (ne cible pas une action précise). */
export const MAINTENANCE_BANNER_PRIMARY =
  "DogShift est actuellement en maintenance. Certaines actions sont temporairement indisponibles.";

/** Alias (API / imports historiques). */
export const DEFAULT_MAINTENANCE_PUBLIC_MESSAGE = MAINTENANCE_BANNER_PRIMARY;

/** Sous-texte bandeau & messages UI : réservations / paiement (pages sitter, réservation, checkout). */
export const MAINTENANCE_CONTEXT_BOOKING_PAYMENT =
  "Les réservations et le paiement en ligne sont temporairement indisponibles.";

/** Sous-texte bandeau & messages UI : contributions uniquement. */
export const MAINTENANCE_CONTEXT_CONTRIBUTIONS = "Les contributions sont temporairement indisponibles.";

/** Message court pour erreurs / CTA (réservations + paiement), avec précision admin optionnelle. */
export function maintenanceBookingUserMessage(adminNote: string | null | undefined): string {
  const n = typeof adminNote === "string" && adminNote.trim() ? adminNote.trim() : null;
  return n ? `${MAINTENANCE_CONTEXT_BOOKING_PAYMENT} — ${n}` : MAINTENANCE_CONTEXT_BOOKING_PAYMENT;
}

/** Ligne contextuelle sous le message principal du bandeau ; null si aucune précision utile. */
export function getMaintenanceContextLine(pathname: string | null): string | null {
  if (!pathname) return null;
  if (pathname === "/contribuer" || pathname.startsWith("/contribuer/")) {
    return MAINTENANCE_CONTEXT_CONTRIBUTIONS;
  }
  if (pathname.startsWith("/checkout/")) {
    return MAINTENANCE_CONTEXT_BOOKING_PAYMENT;
  }
  if (pathname.includes("/reservation")) {
    return MAINTENANCE_CONTEXT_BOOKING_PAYMENT;
  }
  if (/^\/sitter\/[^/]+$/i.test(pathname)) {
    return MAINTENANCE_CONTEXT_BOOKING_PAYMENT;
  }
  return null;
}
