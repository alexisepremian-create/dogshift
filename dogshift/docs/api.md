# API Endpoints

Toutes les routes sont sous `app/api/`. Validation via **Zod**. Auth via **Auth.js v5** (cookie `authjs.session-token` ou `__Secure-authjs.session-token` selon HTTP/HTTPS). Voir [`docs/AUTH.md`](./AUTH.md) pour la stack auth complète.

---

## Auth & Accès

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/register` | Inscription utilisateur (email + password, envoie email de vérification) |
| POST | `/api/auth/forgot-password` | Demande reset password (always 200, anti-leak) |
| POST | `/api/auth/reset-password` | Reset password depuis lien email |
| POST | `/api/auth/set-password` | Définir/rotater le mot de passe (signed-in) |
| GET | `/api/auth/resolve-redirect` | Redirect post-auth selon role |
| ALL | `/api/auth/[...nextauth]` | Catch-all Auth.js : signin / callback / session / csrf / providers |
| POST | `/api/access` | Vérifier code d'accès booking |
| POST | `/api/unlock` | Déverrouiller le site (mode pilote) |
| GET | `/api/site-lock-status` | Statut verrouillage |
| GET | `/api/health` | Health check |
| GET | `/api/ping` | Ping simple |

---

## Compte propriétaire (`/api/account/`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/account/context` | Contexte utilisateur courant (rôle, profil, etc.) |
| POST | `/api/account/delete` | Supprimer le compte |
| GET | `/api/account/bookings` | Lister les réservations de l'owner |
| GET | `/api/account/bookings/[id]` | Détail d'une réservation |
| POST | `/api/account/bookings/[id]/cancel` | Annuler une réservation |
| POST | `/api/account/bookings/[id]/archive` | Archiver |
| POST | `/api/account/bookings/[id]/unarchive` | Désarchiver |
| GET | `/api/account/wallet` | Portefeuille / solde owner |
| GET | `/api/account/messages/conversations` | Lister conversations |
| GET | `/api/account/messages/conversations/[id]` | Détail conversation |
| GET | `/api/account/messages/conversations/[id]/messages` | Messages d'une conversation |
| POST | `/api/account/messages/conversations/start` | Démarrer une conversation |
| GET | `/api/account/settings/me` | Paramètres utilisateur |
| POST | `/api/account/email-verification/send` | Envoyer email de vérification |

---

## Réservations (`/api/bookings/`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/bookings` | Lister réservations (legacy) |
| POST | `/api/bookings` | Créer une réservation + Stripe Payment Intent |
| GET | `/api/bookings/[id]` | Détail réservation |
| POST | `/api/bookings/[id]/cancel` | Annuler |

Champs requis pour `POST /api/bookings` :
```json
{
  "sitterId": "string",
  "serviceType": "PROMENADE | DOGSITTING | PENSION",
  "startAt": "ISO datetime",
  "endAt": "ISO datetime",
  "message": "string (optionnel)"
}
```

---

## Disponibilités (`/api/sitters/[sitterId]/`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/sitters/[sitterId]/availability` | Disponibilités sur une plage de dates |
| GET | `/api/sitters/[sitterId]/day-status` | Statut d'un jour (AVAILABLE/ON_REQUEST/UNAVAILABLE) |
| GET | `/api/sitters/[sitterId]/day-status/multi` | Statuts de plusieurs jours en batch |
| GET | `/api/sitters/[sitterId]/boarding-status` | Disponibilité pension (multi-jours) |
| GET | `/api/sitters/[sitterId]/day-details` | Détail horaire d'un jour (créneaux) |
| GET | `/api/sitters/[sitterId]/slots` | Créneaux disponibles pour une date |
| PUT | `/api/availability` | Mettre à jour les disponibilités (sitter authentifié) |
| POST | `/api/sitters/me/availability-rules` | Définir règles hebdomadaires |
| POST | `/api/sitters/me/availability-exceptions` | Ajouter exceptions ponctuelles |
| POST | `/api/sitters/me/availability-reset` | Réinitialiser aux valeurs par défaut |
| GET | `/api/sitters/me/audit` | Audit des changements de disponibilité |
| POST | `/api/sitters/me/availability-init` | Initialiser les règles par défaut |

---

## Profils sitters (`/api/sitters/`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/sitters` | Lister les sitters publiés |
| GET | `/api/sitters/[sitterId]` | Profil d'un sitter |
| POST | `/api/sitters/me/service-config` | Configurer les contraintes de service |
| POST | `/api/sitters/me/last-minute` | Activer/désactiver réservations last-minute |
| POST | `/api/role/make-sitter` | Convertir un user en sitter |
| POST | `/api/become-sitter/apply` | Soumettre une candidature |

---

## Dashboard sitter (`/api/host/`)

### Profil
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/host/profile` | Récupérer le profil |
| POST | `/api/host/profile` | Mettre à jour le profil |
| POST | `/api/host/profile/pricing` | Mettre à jour les tarifs |
| POST | `/api/host/profile/avatar/presign` | URL présignée pour upload avatar |
| POST | `/api/host/profile/avatar/commit` | Finaliser l'upload de l'avatar |

### Demandes de réservation
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/host/requests` | Lister les demandes entrantes |
| GET | `/api/host/requests/[id]` | Détail d'une demande |
| POST | `/api/host/requests/[id]/accept` | Accepter |
| POST | `/api/host/requests/[id]/decline` | Refuser |
| POST | `/api/host/requests/[id]/cancel-confirmed` | Annuler une réservation déjà confirmée |
| POST | `/api/host/requests/[id]/archive` | Archiver |
| POST | `/api/host/requests/[id]/unarchive` | Désarchiver |

### Messages
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/host/messages/conversations` | Lister les conversations sitter |
| GET | `/api/host/messages/conversations/[id]` | Détail |
| GET | `/api/host/messages/conversations/[id]/messages` | Messages |
| POST | `/api/host/messages/conversations/start` | Démarrer une conversation |

### Stripe Connect
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/host/stripe/connect/create` | Créer un compte Stripe Connect |
| GET | `/api/host/stripe/connect/status` | Statut d'onboarding |
| GET | `/api/host/stripe/connect/link` | Lien d'onboarding Stripe |
| GET | `/api/host/stripe/connect/login-link` | Lien vers le dashboard Stripe sitter |

### Vérification & Contrat
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/host/verification/status` | Statut de vérification |
| POST | `/api/host/verification/presign` | URL présignée pour upload documents |
| POST | `/api/host/verification/submit` | Soumettre les documents |
| POST | `/api/host/verification/delete` | Supprimer les documents |
| GET | `/api/host/contract` | Consulter le contrat |
| POST | `/api/host/accept-terms` | Accepter les CGU |
| POST | `/api/host/accept-compliance` | Accepter la conformité |
| POST | `/api/host/activation-code` | Activer le compte avec le code DS-XXXX-XXXX |
| GET | `/api/host/contract-amendment/current` | Avenant actif |
| POST | `/api/host/contract-amendment/accept` | Accepter l'avenant |

---

## Paiements Stripe (`/api/stripe/`)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/stripe/webhook` | Webhook Stripe (charge.succeeded, refunded, etc.) |
| POST | `/api/stripe/checkout` | Créer une session Checkout |
| POST | `/api/stripe/payment-intent` | Créer un Payment Intent |
| GET | `/api/stripe/session` | Statut d'une session Checkout |

Événements Stripe traités : `charge.succeeded`, `charge.refunded`, `payment_intent.payment_failed`, `checkout.session.completed`.

---

## Contrats (`/api/contract/`)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/contract/sign/[token]` | Signer le contrat avec un token sécurisé |
| POST | `/api/contract/generate-pdf` | Générer le PDF du contrat |

---

## Administration (`/api/admin/`)

Toutes ces routes nécessitent le rôle admin (vérifié via Auth.js session role=ADMIN + email dans `ADMIN_EMAILS` + code admin via cookie `ds_admin_session`).

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/admin/pilot-sitter-applications` | Lister candidatures |
| POST | `/api/admin/pilot-sitter-applications/status` | Changer statut candidature |
| POST | `/api/admin/pilot-sitter-applications/send-interview-email` | Envoyer email interview (HIGH) |
| POST | `/api/admin/pilot-sitter-applications/calendly-link` | Définir lien Calendly |
| GET | `/api/admin/pilot-sitter-applications/contract-details` | Données contrat |
| POST | `/api/admin/pilot-sitter-applications/contract` | Émettre contrat |
| GET | `/api/admin/verifications/pending` | Vérifications en attente |
| POST | `/api/admin/verifications/review` | Approuver/rejeter vérification |
| POST | `/api/admin/verifications/presign` | URL pour visualiser documents |
| GET | `/api/admin/sitters/active` | Sitters actifs |
| GET | `/api/admin/bookings` | Toutes les réservations |
| POST | `/api/admin/bookings/[id]/payout` | Virement manuel |
| POST | `/api/admin/contract-amendments` | Créer un avenant |
| POST | `/api/admin/contract-amendments/[id]/activate` | Activer un avenant |
| POST | `/api/admin/geocode-sitters` | Géocoder les sitters en batch |
| GET/POST | `/api/admin/platform-settings` | Paramètres plateforme (maintenance) |
| GET/POST | `/api/admin/service-costs` | Coûts de service |
| POST | `/api/admin/notes` | Créer une note admin |
| POST | `/api/admin/notify-users` | Notifications bulk |
| GET | `/api/admin/audit` | Journal d'audit |

---

## Cron Jobs (`/api/cron/`)

Ces routes sont appelées par Vercel selon le planning de `vercel.json`. Protégées par `CRON_SECRET` Vercel.

| Route | Fréquence | Description |
|-------|-----------|-------------|
| `/api/cron/review-requests` | `0 3 * * *` (3h UTC) | Envoyer emails de demande d'avis (72h post-réservation) |
| `/api/cron/release-booking-payouts` | `15 * * * *` (toutes les heures) | Libérer les virements sitters via Stripe Transfer |
| `/api/cron/reconcile-payouts` | `0 6 * * *` (6h UTC) | Réconcilier le ledger vs état Stripe réel |
| `/api/cron/audit-cleanup` | `0 4 1 * *` (4h UTC, 1er du mois) | Tronquer les anciens logs d'audit |
| `/api/cron/booking-reminders` | — | Rappels réservations à venir |
| `/api/cron/expire-pending-bookings` | — | Expirer les PENDING_ACCEPTANCE après délai |
| `/api/cron/bug-regression-check` | `7 2 * * *` | Lit `docs/bugs/*.md`, exécute le bloc `## 🤖 Automated detection` de chaque fiche, envoie un récap Telegram (bot maintenance). Idempotent par jour, bypass avec `?force=1`. Voir `brain/🐛 Bugs/Workflow.md`. |

---

## Autres

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/notifications` | Notifications in-app de l'utilisateur |
| GET | `/api/notifications/unread-count` | Nombre de non-lues |
| POST | `/api/notifications/mark-read` | Marquer comme lue |
| POST | `/api/reviews` | Créer un avis post-réservation |
| GET | `/api/reviews/eligibility` | L'utilisateur peut-il laisser un avis ? |
| POST | `/api/support/contact` | Formulaire de contact |
| POST | `/api/invites/verify` | Vérifier un code d'invitation |
| GET | `/api/media/sitter-avatar/[token]` | Récupérer l'avatar sitter |
| GET | `/api/platform/status` | Page statut plateforme |

---

## Format des erreurs

Toutes les erreurs API appellent `reportApiError()` depuis `lib/observability/reportApiError.ts` pour Sentry.

Format de réponse d'erreur :
```json
{
  "error": "Message lisible",
  "code": "ERROR_CODE_SNAKE_CASE"
}
```

Codes HTTP standards : 400 (validation), 401 (non auth), 403 (non autorisé), 404 (not found), 409 (conflit), 500 (interne).
