# Stack technique

## Frontend

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | Next.js (App Router) | 16 |
| UI Library | React | 19 |
| Langage | TypeScript | 5 |
| Styles | Tailwind CSS | 4 |
| Formulaires | React Hook Form + Zod resolvers | — |
| Cartes | MapTiler GL / Leaflet | — |
| PDF client | jsPDF, pdf-lib | — |

## Backend / API

| Couche | Technologie |
|--------|-------------|
| Runtime | Node.js (Vercel Edge compatible) |
| ORM | Prisma 6 |
| Base de données | PostgreSQL (Neon — pooled + direct URL) |
| Validation | Zod |
| Auth | Auth.js v5 (next-auth@beta) — Google OAuth + Credentials (bcrypt). Voir [`docs/AUTH.md`](./AUTH.md) |
| Paiements | Stripe (Checkout + Payment Intents + Connect) |
| Email | Resend (principal) → SMTP (fallback) → console.log (dev) |
| SMS | Vonage |
| Stockage fichiers | Cloudflare R2 (S3-compatible via AWS SDK) |
| Erreurs | Sentry (scrubbing PII RGPD/nLPD) |
| Scoring candidats | n8n (webhook externe) |
| Notifications admin | Telegram (debug) |

## Infrastructure

| Service | Rôle |
|---------|------|
| Vercel | Hébergement, déploiements, cron jobs |
| Neon | PostgreSQL serverless (connection pooling) |
| Cloudflare R2 | Stockage PDFs contrats + documents vérification |
| Stripe | Paiements owners + virements sitters (Connect) |
| Auth.js v5 | Authentification (in-app — pas de service tiers) |
| Sentry | Monitoring erreurs (PII scrubbing activé) |

## Outils de développement

- **ESLint 9** — linting
- **Husky + lint-staged** — pre-commit hooks
- **Playwright** — tests E2E (smoke tests sur CI)
- **Node native test runner** — tests unitaires (TypeScript direct via `--experimental-strip-types`)

## CI/CD

Pipeline Vercel déclenché sur chaque PR :
1. ESLint
2. TypeScript typecheck
3. Tests unitaires (`npm test`)
4. Build Next.js (`npm run build`)
5. Tests Playwright smoke

Merge automatique via `npm run ship` si tous les checks passent.
