# DogShift — Catalogue complet des emails transactionnels

> Liste de référence de tous les emails envoyés en production, avec leur déclencheur, les données personnalisées utilisées et les fichiers sources.

---

## Emails propriétaires (owner)

| ID | Sujet | Déclencheur | Données personnalisées | Source |
|----|-------|-------------|----------------------|--------|
| `bookingRequest` | "Nouvelle demande de réservation" | Sitter reçoit une réservation (`PAID`) | Dates, sitter name, dog name | `sendNotificationEmail.ts` + `setBookingStatus.ts` |
| `bookingConfirmed` | "Réservation confirmée" | Sitter accepte (`CONFIRMED`) | Dates, sitter name, dog name | `sendNotificationEmail.ts` + `setBookingStatus.ts` |
| `paymentReceived` | "Paiement reçu" | Stripe webhook → `PAID` | Montant, dates | `sendNotificationEmail.ts` + `setBookingStatus.ts` |
| `bookingReminder` | "Rappel de réservation" | Cron J-1 (`booking-reminders`) | Date, sitter name, dog name | `sendNotificationEmail.ts` + `cron/booking-reminders` |
| `bookingCancelled` | "Réservation annulée" | `CANCELLED` par sitter ou owner | Montant éligible remboursement, sitter name | `sendNotificationEmail.ts` + `setBookingStatus.ts` |
| `bookingRefunded` | "Remboursement effectué" | `REFUNDED` | Montant, dates | `sendNotificationEmail.ts` + `setBookingStatus.ts` |
| `bookingAutoExpiredRefunded` | "Réservation expirée" | `REFUNDED` (expired, non acceptée) | Montant, délai | `sendNotificationEmail.ts` + `setBookingStatus.ts` |
| `bookingRefundFailed` | "Remboursement impossible" | `REFUND_FAILED` | Montant | `sendNotificationEmail.ts` + `setBookingStatus.ts` |
| `newMessage` | "Nouveau message de {sitter}" | Sitter envoie un message | Nom sitter | `sendNotificationEmail.ts` |
| `sitterReviewReceived` *(owner side)* | — | — | — | — |
| `reviewRequest` | "Comment s'est passée votre réservation avec {sitter} ?" | Cron J+3 post booking | Sitter name | `cron/review-requests` |
| `welcomeOwner` | "Bienvenue sur DogShift" ou "Bienvenue {prénom}" | 1er login via Clerk | Email, prénom (depuis `User.name`) | `auth/resolve-redirect` |
| `relanceOwner` | (généré par Claude) | Cron toutes les 2h si conv sans réservation | Prénom owner, prénom sitter, ville sitter | `agents/relance-owner` |

---

## Emails sitters (host)

| ID | Sujet | Déclencheur | Données personnalisées | Source |
|----|-------|-------------|----------------------|--------|
| `newBookingRequest` | "Nouvelle demande de {owner}" | Booking `PAID` | Owner name, dog fiche (nom, race, poids, notes) | `sendNotificationEmail.ts` + `setBookingStatus.ts` |
| `sitterBookingConfirmed` | "Réservation confirmée" | Booking `CONFIRMED` | Dates, owner name, dog details | `sendNotificationEmail.ts` + `setBookingStatus.ts` |
| `sitterBookingReminder` | "Rappel de prestation" | Cron J-1 sitter (`sitter-booking-reminders`) | Date, dog name, owner name | `sendNotificationEmail.ts` + `cron/sitter-booking-reminders` |
| `sitterBookingModified` | "Réservation modifiée" | Modification de booking | Nouvelles dates | `sendNotificationEmail.ts` |
| `sitterBookingCancelled` | "Annulation de réservation" | `CANCELLED` | Dates, owner name | `sendNotificationEmail.ts` + `setBookingStatus.ts` |
| `sitterRefundTriggered` | "Remboursement déclenché" | `REFUNDED` côté sitter | Montant, contexte remboursement | `sendNotificationEmail.ts` + `setBookingStatus.ts` |
| `sitterPayoutReceived` | "Virement reçu" | Payout Stripe libéré | Montant, dates | `sendNotificationEmail.ts` + `cron/release-booking-payouts` |
| `sitterReviewReceived` | "{owner} t'a laissé un avis" | Propriétaire poste un avis | Rating, comment, owner name (anonymisé si `anonymous:true`) | `sendNotificationEmail.ts` + `api/reviews` |
| `sitterMonthlyRecap` | "Ton récap {mois}" | Cron 1er du mois | Stats mois précédent (revenus, réservations, avis) | `sendNotificationEmail.ts` + `cron/sitter-monthly-recap` |
| `newMessage` (sitter) | "Nouveau message de {owner}" | Owner envoie un message | Nom owner | `sendNotificationEmail.ts` |

---

## Emails vérification pension

| ID | Sujet | Déclencheur | Données personnalisées | Source |
|----|-------|-------------|----------------------|--------|
| `pension-submission-receipt` | "Vos photos ont bien été reçues" | Soumission photos | Prénom sitter, nombre de photos | `host/pension-verification/submit` |
| `pension-approved` | "Votre logement est approuvé — Pension activée" | Admin approuve manuellement | Prénom sitter | `sendPensionResultEmail()` ← `admin/pension-verifications/review` |
| `pension-needs-review` | "Vos photos sont en cours d'examen" | Edge case agent (photos non chargées) | Prénom sitter | `sendPensionResultEmail()` ← `pensionVerificationAgent.ts` |
| `pension-rejected` | "Photos de vérification non retenues" | Admin refuse manuellement | Prénom sitter | `sendPensionResultEmail()` ← `admin/pension-verifications/review` |

> **Note** : La vérification est 100% manuelle depuis mai 2026. `runPensionVerificationAgent()` n'est plus appelé par le submit route. `sendPensionResultEmail()` est appelée directement par l'admin review route.

---

## Emails inactivité sitter

| ID | Sujet | Déclencheur | Données personnalisées | Source |
|----|-------|-------------|----------------------|--------|
| `inactivity-nudge` | "Ajoutez vos disponibilités pour être visible" | Cron J+0 (profil publié sans dispo) | Prénom sitter | `cron/inactivity-check` |
| `inactivity-warning1` | "Votre compte sera suspendu — ajoutez vos disponibilités" | Cron J+4 | Prénom sitter, jours restants | `cron/inactivity-check` |
| `inactivity-warning2` | "Dernier avertissement — suspension imminente" | Cron J+7 | Prénom sitter, jours restants | `cron/inactivity-check` |
| `inactivity-suspended` | "Votre compte DogShift a été suspendu" | Cron J+9 | Prénom sitter | `cron/inactivity-check` |

---

## Emails onboarding & lead

| ID | Sujet | Déclencheur | Données personnalisées | Source |
|----|-------|-------------|----------------------|--------|
| `welcomeOwner` | "Bienvenue sur DogShift" | 1er login owner | Prénom (optionnel) | `auth/resolve-redirect` |
| `onboardingOwner` | "Bienvenue sur DogShift" | Action admin/Maestro | Prénom (depuis body POST) | `agents/onboarding-owner` |
| `reviewRequest` | "Comment s'est passée votre réservation ?" | Cron J+3 | Sitter name | `cron/review-requests` |
| Lead nurturing J+1 | "3 raisons de choisir DogShift" | Cron 9h00 (leads non convertis) | Prénom lead (optionnel) | `cron/lead-nurturing` |
| Lead nurturing J+3 | "Votre chien mérite…" | idem | Prénom lead | `cron/lead-nurturing` |
| Lead nurturing J+7 | "Votre premier mois offert…" | idem | Prénom lead | `cron/lead-nurturing` |

---

## Crons actifs (vercel.json)

| Path | Schedule | Emails envoyés |
|------|----------|---------------|
| `/api/cron/review-requests` | `0 3 * * *` | `reviewRequest` |
| `/api/cron/release-booking-payouts` | `15 * * * *` | `sitterPayoutReceived` |
| `/api/cron/reconcile-payouts` | `0 6 * * *` | (audit only) |
| `/api/cron/audit-cleanup` | `0 4 1 * *` | (cleanup only) |
| `/api/cron/relance-owners` | `0 */2 * * *` | `relanceOwner` (via Claude) |
| `/api/cron/lead-nurturing` | `0 9 * * *` | Séquence nurturing |
| `/api/cron/inactivity-check` | `0 10 * * *` | Nudge / warning / suspended |
| `/api/cron/sitter-booking-reminders` | `0 17 * * *` | `sitterBookingReminder` |
| `/api/cron/sitter-monthly-recap` | `0 9 1 * *` | `sitterMonthlyRecap` |

> **Note** : `/api/cron/booking-reminders` (rappel propriétaire J-1) existe dans le code mais **n'est pas listé dans vercel.json** — il n'est pas déclenché automatiquement.

---

## Modèle de données clés

### `DogProfile` (chien du propriétaire)
```prisma
model DogProfile {
  id       String  @id
  userId   String              // owner
  name     String              // REQUIS
  breed    String?
  birthYear Int?
  weightKg  Float?
  medications        String?
  allergies          String?
  vetContact         String?
  behaviorNotes      String?
  feedingNotes       String?
  sitterInstructions String?
  photoUrl  String?
  neutered  Boolean?
  isDefault Boolean @default(false)
  bookings  Booking[]          // bookings liés à ce chien
}
```

### `Booking`
```prisma
dogProfileId String?            // → selectedDog (le chien de la réservation)
selectedDog  DogProfile?        // relation
```

### Récupérer le nom du chien depuis un booking
```typescript
const booking = await prisma.booking.findUnique({
  where: { id: bookingId },
  select: {
    selectedDog: { select: { name: true, breed: true, weightKg: true } },
  },
});
const dogName = booking?.selectedDog?.name ?? "votre chien";
```
