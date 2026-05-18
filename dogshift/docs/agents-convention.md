# Convention — Agents autonomes

> **Règle d'or :** tout agent autonome doit être visible dans le panel admin
> (`/admin/agents`). Sans exception. C'est la vue globale par laquelle Alexis
> contrôle ce qui tourne dans le système — un agent invisible est un agent
> qui n'existe pas pour lui.

## Ce qu'on appelle "agent autonome"

Toute logique qui s'exécute **sans interaction directe de l'utilisateur**, sur
un signal externe ou programmé :

- **Cron** — schedule défini dans `vercel.json` (ou GitHub Actions pour les
  cas n8n-era genre deps-agent / deps-weekly)
- **Webhook** — endpoint qui reçoit un événement externe (Cal.com,
  formulaires marketing, hooks internes du Maestro)
- **Hybride** — route qui peut être appelée à la fois par un cron et
  manuellement (ops, force re-run)

Ne sont pas des agents : les routes appelées en synchrone par l'UI dans le
flux normal (`/api/bookings`, `/api/auth/register`, etc.).

## Checklist quand tu ajoutes un nouvel agent

1. **Crée la route** sous `/api/agents/<id>` (webhook) ou `/api/cron/<id>`
   (cron). Suis le squelette dans `brain/🧠 Décisions/Conventions cron DogShift.md`
   pour les crons (Bearer auth, idempotence, `ensurePrismaWarm`).
2. **Ajoute-le à `ROUTE_MAP`** dans `app/api/admin/agents-health/route.ts`.
   Sans ça, le ping de liveness le marque "unknown".
3. **Ajoute-le à `AGENTS`** dans `app/(protected)/admin/agents/page.tsx` :
   - Choisis un id stable (kebab-case)
   - Choisis un icône Lucide et une couleur dans `COLORS`
   - Range-le dans une zone : `FREE_AGENTS`, `MAESTRO_CHILDREN`, ou
     `CANDIDATURE_CHILDREN`
   - Si tu mets un nouvel agent dans `FREE_AGENTS` au-delà des slots
     disponibles, étends `FREE_CX` pour ajouter une position.
4. **Documente l'agent** dans `brain/🤖 Agents/<Nom>.md` (vue détaillée
   personnelle) — format dans `brain/🤖 Agents/Agents.md`.
5. **Si l'agent loggue dans `AgentLog`** (recommandé) → utilise
   `agentName = "<id>"` cohérent avec celui du panel.
6. **Si l'agent envoie un Telegram** → utilise le bot adapté
   (`maintenance` pour les crons d'infra, `candidatures` pour le funnel
   sitter, `relances` pour les emails marketing, etc. — voir
   `docs/telegram.md`).
7. **Si l'agent est un cron** → ajoute la fiche dans `docs/bugs/`
   monitoring (ex: `monitoring-<agent-name>.md`) avec un bloc
   `## 🤖 Automated detection` que le cron de regression check
   réutilisera (probe HTTP sur la route + check d'AgentLog frais).

## Pourquoi cette discipline

- **Visibilité opérationnelle** : un dashboard suffit pour voir ce qui
  est vivant. Pas besoin de fouiller dans le code ou Vercel.
- **Cohérence audit** : tout agent loggué dans `AgentLog` avec un
  `agentName` qui matche celui du panel = filtrage trivial pour stats /
  debug.
- **Onboarding contributeur** : un nouveau dev (ou un nouveau Claude)
  comprend la flotte d'agents en 30 secondes via le panel.
- **Évite les "agents fantômes"** : du code qui tourne quelque part sans
  qu'on s'en souvienne (et qu'on déteste découvrir 6 mois plus tard via
  une facture ou une erreur).

## État actuel (snapshot 2026-05-18)

19 agents inventoriés. Détails individuels dans `brain/🤖 Agents/`.

| Catégorie | Count | Exemples |
|---|---|---|
| Webhooks actifs | 13 | candidature, calendrier, contrat, activation, lead-magnet, onboarding-owner, zootherapie-evaluation, booking, notifications, candidature-classic, candidature-ai |
| Crons Vercel | 2 | dog-news (08h), bug-regression-check (02h07) |
| Cron GitHub Actions | 2 | deps-agent (nightly 02h), deps-weekly (lundi 07h) |
| Orchestrateur | 1 | maestro |
| Stubs (pas encore implémentés) | 3 | auth, reservations, assistant |

## Distinction Vercel cron vs GitHub Actions

- **Vercel cron** (déclaré dans `vercel.json`) → exécuté par l'infra
  Vercel, hits la route Next.js avec Bearer `CRON_SECRET`.
- **GitHub Actions** → workflow dans `.github/workflows/`, peut aussi
  hit la route Next.js mais avec Bearer `MAINTENANCE_API_KEY`. Préféré
  quand le job a besoin de l'environnement Node/GitHub (genre `npm
  outdated`, `gh pr create`).
