# Structure des dossiers

```
dogshift/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # Pages publiques (sans auth)
│   │   ├── page.tsx              # Homepage avec carte + aperçu sitters
│   │   ├── layout.tsx            # Layout marketing (header, footer)
│   │   ├── search/               # Résultats de recherche de sitters
│   │   ├── sitter/[sitterId]/    # Fiche sitter + modal de réservation
│   │   ├── account/              # Dashboard propriétaire
│   │   │   ├── bookings/         # Liste et détail des réservations
│   │   │   ├── messages/         # Messagerie
│   │   │   ├── settings/         # Paramètres compte
│   │   │   └── wallet/           # Portefeuille / remboursements
│   │   ├── become-sitter/        # Formulaire candidature sitter
│   │   │   ├── form/             # Formulaire multi-étapes
│   │   │   ├── activate/         # Saisie du code d'activation
│   │   │   └── access/           # Vérification code d'accès
│   │   ├── checkout/[bookingId]/ # Page Stripe Checkout
│   │   ├── contract/sign/[token]/ # Signature contrat (canvas + PDF)
│   │   ├── paiement/             # Pages statut paiement (success/cancel/failed/pending)
│   │   ├── dog-sitter-[city]/    # Pages SEO par ville (geneve, lausanne, montreux…)
│   │   ├── devenir-dogsitter/    # Variante FR de become-sitter
│   │   ├── confidentialite/      # Politique de confidentialité
│   │   ├── cgu/                  # Conditions générales d'utilisation
│   │   └── mentions-legales/     # Mentions légales
│   │
│   ├── (protected)/              # Pages authentifiées (Clerk)
│   │   ├── layout.tsx            # Mur d'auth
│   │   ├── admin/                # Outils d'administration
│   │   │   ├── dashboard/        # Analytics
│   │   │   ├── sitter-applications/ # Revue candidatures pilote
│   │   │   ├── sitters/          # Gestion sitters (vérification, actions)
│   │   │   ├── verifications/    # Revue pièces d'identité / selfies
│   │   │   ├── bookings/         # Gestion réservations
│   │   │   ├── finance/          # Réconciliation paiements
│   │   │   ├── avenants/         # Avenants au contrat
│   │   │   ├── communications/   # Notifications bulk
│   │   │   └── securite/         # Audit log
│   │   ├── host/                 # Dashboard sitter
│   │   │   ├── profile/          # Édition du profil
│   │   │   ├── availability/     # Éditeur disponibilités (règles + exceptions)
│   │   │   ├── requests/         # Demandes de réservation entrantes
│   │   │   ├── messages/         # Fil de messages
│   │   │   ├── wallet/           # Statut des virements
│   │   │   ├── contract/         # Consultation du contrat
│   │   │   └── settings/         # Paramètres compte
│   │   └── dashboard/            # Alias dashboard propriétaire
│   │
│   ├── api/                      # Routes API REST
│   │   ├── access/               # Codes d'accès
│   │   ├── account/              # Compte propriétaire (bookings, messages, wallet)
│   │   ├── admin/                # Endpoints admin (35 routes)
│   │   ├── auth/                 # Inscription, mot de passe, redirects
│   │   ├── availability/         # Mise à jour disponibilités
│   │   ├── bookings/             # CRUD réservations
│   │   ├── contract/             # Signature + génération PDF
│   │   ├── cron/                 # Tâches planifiées Vercel (6 routes)
│   │   ├── host/                 # Dashboard sitter (profil, demandes, stripe connect)
│   │   ├── notifications/        # Notifications in-app
│   │   ├── reviews/              # Avis post-réservation
│   │   ├── sitters/              # Profils et disponibilités sitters
│   │   ├── stripe/               # Webhooks et sessions Stripe
│   │   ├── support/              # Formulaire de contact
│   │   └── webhooks/clerk/       # Webhook Clerk (création/suppression utilisateur)
│   │
│   ├── login/ signup/            # Pages auth Clerk
│   ├── layout.tsx                # Layout racine (providers, styles globaux)
│   ├── robots.ts                 # Robots.txt dynamique
│   └── sitemap.ts                # Sitemap XML dynamique
│
├── lib/                          # Logique métier et utilitaires
│   ├── availability/             # Moteur de créneaux
│   │   ├── slotEngine.ts         # generateDaySlots(), checkBoardingRange()
│   │   ├── dayStatus.ts          # Statut d'un jour (AVAILABLE / ON_REQUEST / UNAVAILABLE)
│   │   ├── dayStatusMulti.ts     # Statut multi-jours (pension)
│   │   ├── rangeValidation.ts    # Validation durée min/max
│   │   ├── reasonBuckets.ts      # Catégorisation des raisons d'indisponibilité
│   │   └── auditLog.ts           # Audit des changements
│   ├── bookings/                 # Transitions d'état des réservations
│   ├── stripe/                   # Intégration Stripe (paiements, virements, frais)
│   ├── email/                    # Emails transactionnels + templates
│   ├── validators/               # Schémas Zod pour toutes les entrées API
│   ├── sitterApplication/        # Candidature sitter (formulaire, scoring n8n)
│   ├── auth/                     # Helpers Clerk + NextAuth
│   ├── notifications/            # Notifications in-app + email
│   ├── observability/            # reportApiError.ts → Sentry
│   ├── sitterContract.ts         # Signature, PDF, avenants
│   ├── sitterGuards.ts           # Permission checks (est vérifié, activé…)
│   ├── sitterMapGeo.ts           # Géocodage, lat/lng
│   ├── financeEvents.ts          # Journal des événements financiers
│   ├── r2.ts                     # URLs présignées Cloudflare R2
│   ├── commission.ts             # Taux de commission (10%)
│   └── prisma.ts                 # Client Prisma singleton
│
├── prisma/
│   └── schema.prisma             # Modèle de données complet
│
├── tests/                        # Tests unitaires
│   ├── availability/             # Tests moteur de créneaux
│   └── validators/               # Tests validateurs Zod
│
├── public/                       # Assets statiques
│
├── CLAUDE.md                     # Instructions pour Claude Code
├── WORKFLOW.md                   # Workflow de livraison (npm run ship)
├── AGENT.md                      # Instructions étendues pour agents IA
├── package.json
├── tsconfig.json
└── vercel.json                   # Config Vercel (crons, redirects)
```

## Conventions de nommage

- **Route groups** : `(marketing)`, `(protected)` — parenthèses = pas dans l'URL
- **Routes dynamiques** : `[sitterId]`, `[id]`, `[token]` — crochets standard Next.js
- **Fichiers** : camelCase pour les modules, PascalCase pour les composants React
- **API** : resources plurielles (`/api/sitters`, `/api/bookings`), actions en sous-chemin (`/api/bookings/[id]/cancel`)
