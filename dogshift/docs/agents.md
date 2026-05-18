# agents.md — Instructions pour agents IA

Ce fichier complète `CLAUDE.md` avec des instructions plus détaillées destinées aux agents IA (Claude Code, sous-agents, etc.) travaillant sur ce projet.

## Contexte du projet

**DogShift** est une marketplace suisse de garde de chiens (dogshiftt.ch). Les propriétaires de chiens réservent des sitters vérifiés. Le projet est en phase pilote avec accès contrôlé par codes d'invitation.

Conformité légale : **RGPD + nLPD** (loi suisse). Ne jamais écrire de PII dans les logs, audit trails ou métadonnées. Utiliser uniquement des IDs.

---

## Règles absolues

### 1. Tests obligatoires
Chaque correction de bug **doit** ajouter un test de régression dans `tests/`. Sans test, la PR est incomplète. Voir les exemples dans `tests/availability/` et `tests/validators/`.

### 2. Reporting des erreurs API
Chaque route API qui attrape une erreur **doit** appeler `reportApiError()` depuis `lib/observability/reportApiError.ts`. Pas de `console.error` seul. Sentry doit recevoir l'événement avec les tags `error_kind`, `error_code`, `error_route`.

### 3. Pas de PII dans les logs
Les `AuditLog`, `BookingFinanceEvent`, et métadonnées Sentry ne doivent contenir **que des IDs** (userId, bookingId, sitterId). Jamais d'email, nom, téléphone.

### 4. Validation Zod systématique
Toutes les entrées API doivent être validées avec un schéma Zod dans `lib/validators/`. Ne pas faire de validation ad hoc dans la route.

### 5. Sécurité Stripe
Ne jamais faire confiance au montant envoyé par le client. Toujours recalculer côté serveur depuis les données DB. Les webhooks Stripe doivent être vérifiés avec `stripe.webhooks.constructEvent()`.

---

## Architecture à respecter

### Moteur de disponibilité
Le cœur du produit est `lib/availability/slotEngine.ts`. Ce fichier est critique — tout changement doit être couvert par des tests unitaires exhaustifs. Les trois types de service ont des contraintes différentes :
- **PROMENADE** : créneaux horaires (step configurable, ex: 30 min)
- **DOGSITTING** : journées entières
- **PENSION** : plages multi-jours avec check-in/check-out configurables

Ne jamais pre-calculer les créneaux en DB. Ils sont toujours calculés à la volée depuis les `AvailabilityRule` + `AvailabilityException` + `Booking` existants.

### Identifiants sitters
**Attention** : `User.id` ≠ `User.sitterId`. Le `sitterId` est l'identifiant métier du sitter, utilisé comme FK dans `Booking.sitterId`, `SitterProfile.sitterId`, `AvailabilityRule.sitterId`, etc. Ne jamais confondre les deux.

### Statuts de booking — machine d'états
```
DRAFT → PENDING_PAYMENT → PENDING_ACCEPTANCE → CONFIRMED
                                             → CANCELLED
               ↓
        PAYMENT_FAILED
               
CONFIRMED → REFUNDED / REFUND_FAILED
CONFIRMED → CANCELLED (host-initiated)
```
Les transitions sont dans `lib/bookings/transitionBookingAfterPayment.ts`. Ne jamais changer le statut directement avec Prisma en dehors de ces helpers.

### Commission
Fixée à **10%** dans `lib/commission.ts`. Ne pas hardcoder ailleurs.

---

## Workflow de livraison

### Happy path
```bash
npm run ship -- "type(scope): message court"
```

Convention commits : `fix:`, `feat:`, `chore:`, `refactor:`, `docs:`, `test:`.

### Quand NE PAS utiliser `npm run ship`
- Changements risqués sur le moteur de paiement → draft PR d'abord
- Migrations DB non-backwards-compatible → vérifier impact sur prod
- Modifications des webhooks Stripe → tester avec Stripe CLI localement

### Avant de merger
- [ ] `npm test` passe
- [ ] `npm run build` passe (inclut `prisma generate`)
- [ ] `npm run lint` passe
- [ ] Test de régression ajouté si c'est un bug fix
- [ ] `reportApiError()` appelé dans tous les nouveaux catch blocks

---

## Patterns de code à respecter

### Routes API
```typescript
// Toujours valider en premier
const body = BookingSchema.safeParse(await req.json());
if (!body.success) {
  return NextResponse.json({ error: "Invalid input" }, { status: 400 });
}

// Attraper et reporter
try {
  // ... logique
} catch (err) {
  reportApiError(err, { route: "/api/bookings", error_kind: "booking_creation" });
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
```

### Prisma — éviter les requêtes N+1
Toujours utiliser `include` ou `select` explicite. Ne jamais faire de boucle avec des requêtes DB individuelles — utiliser `prisma.findMany` avec les bonnes conditions.

### Emails
Utiliser `lib/email/sendEmail.ts` uniquement. Ne jamais importer Resend ou Nodemailer directement dans une route. Le module gère le fallback automatiquement.

### Cloudflare R2
Utiliser `lib/r2.ts` pour les URLs présignées. Ne jamais exposer les credentials dans le client.

---

## Points d'attention fréquents

### Coordonnées GPS sitters
Certains sitters dans des petits villages suisses peuvent avoir `lat = null` / `lng = null` après géocodage (MapTiler ne couvre pas tous les villages). Il existe un fallback hardcodé pour Penthaz/1303. Si d'autres cas similaires apparaissent, voir `docs/bugs.md` pour la stratégie recommandée (table de référence NPA).

### Mode pilote
`PILOT_MODE=true` active un verrouillage du site. La vérification se fait dans le middleware et `lib/platform/`. En développement sans cette variable, le site est ouvert.

### Maintenance mode
`PlatformSettings` (singleton `id = "global"`) peut activer un mode maintenance. Vérifier `lib/platform/` avant de modifier les pages publiques.

### Clerk v7
La migration vers Clerk v7 a changé la structure des erreurs. Toujours utiliser `lib/auth/clerkErrorMessage.ts` pour extraire le message lisible depuis une erreur Clerk, pas `err.errors[0].message` directement.

### Webhooks Sentry
Les tags Sentry standards sont : `error_kind`, `error_code`, `error_route`. Le scrubber PII retire automatiquement les emails, noms, téléphones des événements. Ne pas désactiver le scrubber.

---

## Documentation du projet

Voir le dossier `docs/` :
- `docs/stack.md` — Stack technique complète
- `docs/structure.md` — Structure des dossiers
- `docs/data-models.md` — Modèles Prisma et relations
- `docs/api.md` — Tous les endpoints API
- `docs/commands.md` — Commandes utiles (dev, test, deploy)
- `docs/bugs.md` — Bugs connus et leur statut

---

## Ce qu'il ne faut pas faire

- ❌ Modifier `AuditLog` existant — c'est append-only
- ❌ Supprimer des `BookingFinanceEvent` — journal immuable
- ❌ Bypasser la validation Zod dans les routes
- ❌ Faire confiance aux montants envoyés par le client
- ❌ Exposer des credentials R2 / Stripe côté client
- ❌ `git add -A` sans vérifier ce qui est staged (risque de committer `.env.local`)
- ❌ Modifier le schema Prisma sans créer une migration
- ❌ Changer le taux de commission sans mettre à jour `lib/commission.ts` **et** les tests
- ❌ Écrire de la PII dans les métadonnées d'audit ou Sentry
