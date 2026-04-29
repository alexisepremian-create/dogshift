# Modèles de données (Prisma)

Base de données : **PostgreSQL (Neon)** — `prisma/schema.prisma`

---

## Enums

### `Role`
```
OWNER    — Propriétaire de chien (peut réserver)
SITTER   — Prestataire de garde (peut recevoir des réservations)
```
Un User peut avoir les deux rôles simultanément.

### `BookingStatus`
```
DRAFT               — Brouillon créé côté client
PENDING_PAYMENT     — En attente du paiement Stripe
PENDING_ACCEPTANCE  — Payé, en attente d'acceptation du sitter
PAID                — Payé (alias de CONFIRMED pour certains flows)
CONFIRMED           — Confirmé par le sitter
PAYMENT_FAILED      — Échec du paiement
CANCELLED           — Annulé
REFUNDED            — Remboursé
REFUND_FAILED       — Tentative de remboursement échouée
```

### `ServiceType`
```
PROMENADE   — Promenade (facturation horaire)
DOGSITTING  — Garde à domicile (facturation journalière)
PENSION     — Pension (multi-jours, boarding)
```

### `AvailabilityStatus`
```
AVAILABLE    — Disponible directement
ON_REQUEST   — Sur demande (nécessite confirmation sitter)
UNAVAILABLE  — Indisponible
```

### `VerificationStatus`
```
not_verified  — Aucun document soumis
pending       — Documents en cours de revue admin
approved      — Vérifié et approuvé
rejected      — Documents refusés
```

### `SitterApplicationStatus`
```
PENDING    — Candidature reçue
CONTACTED  — Contacté par l'équipe
ACCEPTED   — Accepté (email interview envoyé)
ACTIVATED  — Compte activé
REJECTED   — Candidature refusée
```

### `SitterLifecycleStatus`
```
application_received — Candidature reçue
selected             — Sélectionné par l'admin
contract_to_sign     — Contrat envoyé, en attente de signature
contract_signed      — Contrat signé
activated            — Profil publié et actif
```

### `NotificationType`
```
newMessages         — Nouveau message
newBookingRequest   — Nouvelle demande de réservation
paymentReceived     — Paiement reçu
bookingConfirmed    — Réservation confirmée
bookingReminder     — Rappel de réservation
```

---

## Modèles principaux

### `User`
Modèle central. Un utilisateur peut être propriétaire ET sitter.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | PK |
| `clerkUserId` | String? unique | ID Clerk (auth principal) |
| `email` | String unique | Email |
| `name` | String? | Nom complet |
| `phone` | String? | Téléphone |
| `role` | Role | OWNER \| SITTER |
| `sitterId` | String? unique | ID sitter (si rôle sitter) — utilisé comme FK dans Booking.sitterId |
| `clerkUserId` | String? | Lien avec Clerk |

Relations : `bookings` (en tant qu'owner), `sitterBookings` (en tant que sitter), `sitterProfile`, `availabilityRules`, `availabilityExceptions`, `serviceConfigs`, `conversations`, `notifications`.

---

### `SitterProfile`
Profil public et données d'onboarding du sitter.

| Champ | Type | Description |
|-------|------|-------------|
| `userId` | String unique | FK → User.id |
| `sitterId` | String unique | FK → User.sitterId |
| `published` | Boolean | Visible dans la recherche ? |
| `displayName` | String? | Nom affiché |
| `city` | String? | Ville |
| `postalCode` | String? | NPA |
| `bio` | String? | Description |
| `avatarUrl` | String? | URL avatar (R2) |
| `lat / lng` | Float? | Coordonnées GPS |
| `services` | Json? | Services proposés |
| `pricing` | Json? | Tarifs par service |
| `dogSizes` | Json? | Tailles de chiens acceptées |
| `lifecycleStatus` | SitterLifecycleStatus | Étape d'onboarding |
| `verificationStatus` | VerificationStatus | Statut vérification identité |
| `contractSignedAt` | DateTime? | Date de signature du contrat |
| `contractSignedPdfUrl` | String? | URL PDF contrat signé (R2) |
| `activationCodeHash` | String? unique | Hash du code d'activation |
| `stripeAccountId` | String? | ID compte Stripe Connect |
| `stripeAccountStatus` | String? | Statut onboarding Stripe |
| `lastMinuteEnabled` | Boolean | Réservations last-minute activées |

---

### `Booking`
Réservation entre un owner et un sitter.

| Champ | Type | Description |
|-------|------|-------------|
| `userId` | String | FK → User.id (owner) |
| `sitterId` | String | FK → User.sitterId (sitter) |
| `serviceType` | ServiceType? | PROMENADE / DOGSITTING / PENSION |
| `startAt / endAt` | DateTime? | Horodatage précis |
| `startDate / endDate` | DateTime? | Dates (pension) |
| `status` | BookingStatus | État courant |
| `amount` | Int | Total en centimes (CHF) |
| `platformFeeAmount` | Int | Commission plateforme (10%) |
| `stripePaymentIntentId` | String? | ID Stripe |
| `stripeChargeId` | String? | ID charge Stripe |
| `stripeTransferId` | String? | ID virement Stripe Connect |
| `sitterPayoutAmount` | Int? | Montant net sitter (centimes) |
| `payoutReleasedAt` | DateTime? | Date de libération du virement |
| `payoutStatus` | BookingPayoutStatus | PENDING / PAID |
| `stripeRefundId` | String? | ID remboursement Stripe |
| `archivedAt` | DateTime? | Archivage |

---

### `AvailabilityRule`
Règle de disponibilité récurrente (par jour de semaine).

| Champ | Type | Description |
|-------|------|-------------|
| `sitterId` | String | FK → User.sitterId |
| `serviceType` | ServiceType | Service concerné |
| `dayOfWeek` | Int | 0=Lundi … 6=Dimanche |
| `startMin` | Int | Minute de début (ex: 480 = 8h00) |
| `endMin` | Int | Minute de fin (ex: 1080 = 18h00) |
| `status` | AvailabilityStatus | AVAILABLE / ON_REQUEST / UNAVAILABLE |

---

### `AvailabilityException`
Override ponctuel pour une date spécifique.

| Champ | Type | Description |
|-------|------|-------------|
| `sitterId` | String | FK → User.sitterId |
| `serviceType` | ServiceType | Service concerné |
| `date` | DateTime (Date) | Date de l'exception |
| `startMin / endMin` | Int | Plage horaire |
| `status` | AvailabilityStatus | Statut de l'exception |

---

### `ServiceConfig`
Contraintes configurables par sitter et par service.

| Champ | Type | Description |
|-------|------|-------------|
| `sitterId + serviceType` | unique | Une config par service |
| `slotStepMin` | Int | Pas des créneaux (ex: 30 min) |
| `minDurationMin` | Int | Durée minimale |
| `maxDurationMin` | Int | Durée maximale |
| `leadTimeMin` | Int | Délai minimum avant réservation |
| `bufferBeforeMin` | Int | Buffer avant le créneau |
| `bufferAfterMin` | Int | Buffer après le créneau |
| `overnightRequired` | Boolean | Pension = nuit obligatoire |
| `checkInStartMin / checkInEndMin` | Int? | Fenêtre d'arrivée |
| `checkOutStartMin / checkOutEndMin` | Int? | Fenêtre de départ |

---

### `PilotSitterApplication`
Candidature sitter (formulaire /become-sitter).

Champs clés : `firstName`, `lastName`, `city`, `email`, `phone`, `experienceText`, `motivationText`, `availabilityText`, `hasDogExperience`, `status` (SitterApplicationStatus).

Champs structurés pour scoring n8n : `npa`, `gardeExperienceLevel`, `availabilityStructured`, `gardeTypes`, `dogSizes`, `housingType`, `hasCarLicense`.

Tracking marketing : `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, `referrer`, `userAgent`, `ip`.

---

### `ContractAmendment` + `SitterContractAmendmentAcceptance`
Système de versioning des avenants au contrat. Un avenant peut être ACTIVE, INACTIVE ou DELETED. Chaque sitter doit l'accepter via `SitterContractAmendmentAcceptance`.

---

### `AuditLog`
Journal d'audit **immuable** (append-only, jamais supprimer).

- `action` : `"booking.created"`, `"booking.paid"`, `"sitter.approved"`, etc.
- `actorType` : `"admin"` | `"user"` | `"system"` | `"stripe"`
- **Aucune PII dans metadata** (IDs uniquement — conformité RGPD/nLPD)

---

### `BookingFinanceEvent`
Journal financier par réservation : charges, virements, remboursements, payouts. Tracé par `actorType` (SYSTEM / ADMIN / STRIPE).

---

### `PlatformSettings`
Singleton (`id = "global"`). Toggle maintenance mode + message.

---

### `Conversation` + `Message`
Messagerie directe owner ↔ sitter. Une conversation est unique par paire `(ownerId, sitterId)`. Peut être liée à une réservation (`bookingId`).

---

## Relations clés

```
User ──────────────── SitterProfile (1:1, via userId)
User ──────────────── Booking[] (en tant qu'owner via userId)
User ──────────────── Booking[] (en tant que sitter via sitterId)
User ──────────────── AvailabilityRule[] (via sitterId)
User ──────────────── AvailabilityException[] (via sitterId)
User ──────────────── ServiceConfig[] (via sitterId)
Booking ───────────── Review (1:1)
Booking ───────────── BookingFinanceEvent[]
Booking ───────────── Conversation[]
SitterProfile ──────── SitterContractAmendmentAcceptance[]
SitterProfile ──────── VerificationAccessLog[]
ContractAmendment ──── SitterContractAmendmentAcceptance[]
```

> **Note importante** : dans la DB, "Sitter" (role `SITTER`) = le prestataire de garde. "Owner" = le propriétaire du chien qui réserve. La colonne `User.sitterId` est l'identifiant métier du sitter, distinct de `User.id`.
