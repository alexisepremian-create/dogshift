/**
 * Contenus SMS transactionnels (sender affiché = expéditeur Vonage, ex. "DogShift").
 * Pas de préfixe "DogShift :" dans le corps.
 */

/** Réservation last-minute auto-confirmée (notif sitter). */
export function smsLastMinuteConfirmedBody(hourZurich: string): string {
  const h = hourZurich.trim();
  return `🐶 Réservation de dernière minute confirmée
Aujourd'hui à ${h}

Consulte les détails sur DogShift.`;
}

/** Confirmation classique (référence produit — aucun envoi actif aujourd’hui). */
export function smsBookingConfirmedBody(hourZurich: string): string {
  const h = hourZurich.trim();
  return `🐶 Nouvelle réservation confirmée
Aujourd'hui à ${h}

Consulte les détails sur DogShift.`;
}

/** Paiement encaissé (référence produit — aucun envoi actif aujourd’hui). */
export function smsPaymentConfirmedBody(): string {
  return `💳 Paiement confirmé
Ta réservation est validée.

Retrouve tous les détails sur DogShift.`;
}

/** Demande refusée par le sitter (référence produit — aucun envoi actif aujourd’hui). */
export function smsBookingDeclinedBody(): string {
  return `❌ Réservation refusée
Le dogsitter n’a pas accepté la demande.

Tu peux réserver un autre dogsitter sur DogShift.`;
}
