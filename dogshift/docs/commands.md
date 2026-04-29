# Commandes utiles

## Développement

```bash
npm run dev              # Démarrer le serveur local (http://localhost:3000, mode webpack)
npm run build            # prisma generate + build Next.js (vérification complète)
npm run lint             # ESLint sur tout le projet
```

## Tests

```bash
npm test                 # Lancer les tests unitaires (Node native test runner, TypeScript direct)
npm run test:watch       # Mode watch (relance à chaque changement)
```

Les tests se trouvent dans `tests/` — essentiellement `tests/availability/` et `tests/validators/`.
Pas de build requis : `--experimental-strip-types` exécute le TypeScript directement.

## Base de données (Prisma)

```bash
npm run migrate:deploy   # Déployer les migrations Prisma en attente (prod/staging)

# Commandes Prisma directes
npx prisma generate      # Régénérer le client Prisma après modif du schema
npx prisma migrate dev   # Créer une migration en développement
npx prisma studio        # Interface graphique pour explorer la DB
npx prisma db push       # Pousser le schema sans créer de migration (dev rapide)
```

## Livraison (workflow standard)

```bash
npm run ship -- "message du commit"
```

Ce script fait tout d'un coup :
1. Commit de tous les changements avec le message fourni
2. Push sur la branche courante
3. Création de la PR GitHub
4. Activation de l'auto-merge

La PR se merge automatiquement si **tous** les checks CI passent :
- ESLint
- TypeScript typecheck
- Tests unitaires
- Build Next.js
- Tests Playwright smoke

Voir `WORKFLOW.md` pour les cas où il faut s'écarter du happy path (changements risqués, drafts, urgences prod).

## Git (manuel)

```bash
git checkout -b fix/mon-bug    # Créer une branche
git add <fichiers>             # Staging ciblé (éviter git add -A)
git commit -m "fix: message"  # Commit
git push -u origin fix/mon-bug # Push + tracking
gh pr create                   # Créer une PR via GitHub CLI
```

## Débogage local

```bash
# Tester l'envoi d'email
curl http://localhost:3000/api/debug/email-test

# Tester l'envoi de SMS
curl http://localhost:3000/api/debug/sms-test

# Vérifier la session auth
curl http://localhost:3000/api/debug-session

# Vérifier la santé de l'API
curl http://localhost:3000/api/health
```

## Variables d'environnement requises

Fichier `.env.local` à la racine :

```env
# Base de données Neon
DATABASE_URL=postgresql://...         # URL poolée (Prisma ORM)
DIRECT_URL=postgresql://...           # URL directe (migrations)

# Clerk (auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Stripe (paiements)
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Carte
NEXT_PUBLIC_MAPTILER_KEY=...

# Email (Resend)
RESEND_API_KEY=re_...

# SMS (Vonage) — optionnel
VONAGE_API_KEY=...
VONAGE_API_SECRET=...

# Cloudflare R2 (stockage fichiers)
CLOUDFLARE_R2_ENDPOINT=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET=...

# Mode pilote
PILOT_MODE=true
PILOT_ADMIN_CODE=...

# Contrats
CONTRACT_TOKEN_SECRET=...

# URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Sentry
SENTRY_DSN=...
```

## Commandes avancées

```bash
# Géocodage batch des sitters (admin)
curl -X POST /api/admin/geocode-sitters \
  -H "Authorization: Bearer <admin-token>"

# Forcer la libération des virements (test)
curl /api/cron/release-booking-payouts \
  -H "Authorization: Bearer <CRON_SECRET>"

# Réconciliation manuelle
curl /api/cron/reconcile-payouts \
  -H "Authorization: Bearer <CRON_SECRET>"
```
