# Audit prod — pages publiques (non-authentifié)
**Date :** 2026-05-22  
**Scope :** pages publiques uniquement (Phase 1). Flows authentifiés à faire en Phase 3.  
**Méthode :** Playwright headless — navigate + accessibility_snapshot + console_messages + network_requests (4xx/5xx)

---

## Récapitulatif des routes

| URL | Statut | Note |
|---|---|---|
| `/` | ✅ OK | |
| `/search` | ✅ OK | CSR, loading state normal |
| `/sitters` | 🔴 404 | Manque redirect → `/search` |
| `/sitter/[id]` | ✅ OK | CSR, loading state normal |
| `/devenir-dogsitter` | ✅ OK | |
| `/become-sitter` | ✅ OK | Seul 403 login RSC |
| `/login` | 🟡 CF challenge | Fonctionne mais challenge Cloudflare sur GET direct |
| `/signup` | 🟡 lien brisé | `/politique-confidentialite` → 404 |
| `/forgot-password` | ✅ OK | |
| `/cgu` | ✅ OK | |
| `/confidentialite` | ✅ OK | |
| `/mentions-legales` | ✅ OK | |
| `/about` | 🟢 404 | Jamais existé |
| `/contact` | 🟢 404 | Jamais existé |
| `/legal/terms` | 🟢 404 | URLs anglaises non créées |
| `/legal/privacy` | 🟢 404 | URLs anglaises non créées |
| `/support` | 🟡 404 | Référencé dans template 404 |

---

## 🔴 BUGS CRITIQUES

### 1. Cloudflare bloque tous les RSC prefetch vers `/login`
- **Symptôme :** `GET /login?_rsc=<token>` → 403 sur home, /search, /sitter/*, /become-sitter, etc.
- **Cause :** Cloudflare "Managed Challenge" activé sur `/login`. Les RSC prefetch Next.js ne passent pas le challenge.
- **Impact :** console error sur chaque page ; first navigation vers `/login` sera légèrement plus lente (pas de prefetch chaud).
- **Fix :** whitelister les requêtes RSC (`?_rsc=`) dans la règle Cloudflare sur `/login`, ou désactiver le Managed Challenge sur `/login` (le formulaire a déjà Auth.js + bcrypt).

---

## 🟡 BUGS IMPORTANTS

### 2. `/signup` → lien brisé vers `/politique-confidentialite` (404)
- `GET /politique-confidentialite?_rsc=...` → 404 au chargement de la page signup
- La bonne URL est `/confidentialite`
- À corriger dans `SignUpForm.tsx` ou le layout signup — chercher `politique-confidentialite` dans le code.

### 3. Template page 404 → lien `/support` qui n'existe pas
- Sur toute page 404 (`/about`, `/contact`, `/sitters`, `/legal/terms`, `/legal/privacy`), le template RSC prefetch `/support` → 404
- La page 404 génère elle-même une 404 enfant.
- À corriger dans `app/not-found.tsx` (ou équivalent).

### 4. `/sitters` → 404 sans redirect
- L'URL `/sitters` n'existe pas ; la liste est sur `/search`.
- Risque : liens externes ou SEO qui pointent vers `/sitters` tombent en 404 sans redirect.
- À ajouter : redirect permanente `301 /sitters → /search` dans `vercel.json` ou `next.config.js`.

### 5. `/login` déclenche un Cloudflare challenge pour bots/crawlers
- Premier GET `/login` → 403 avec interstitiel "Vérification de sécurité en cours"
- Transparent pour les vrais utilisateurs, mais Googlebot peut être bloqué → page login non indexée.
- Si l'indexation est souhaitée : configurer une exception pour les bots Google dans Cloudflare.

---

## 🟢 PROBLÈMES MINEURS (backlog)

### 6. Pages inexistantes attendues
- `/about`, `/contact` → 404 (pas de page "À propos" ni "Contact" — uniquement le bot widget)
- `/legal/terms`, `/legal/privacy` → 404 (URLs anglaises non créées ; `/cgu` et `/confidentialite` OK)
- À créer ou à rediriger si ces URLs sont référencées quelque part (Google Ads, liens externes, etc.)

### 7. Fiche sitter et `/search` : rendu côté client sans SSR
- Affichent "Chargement…" / "Chargement des annonces…" à l'hydratation initiale.
- APIs (`/api/sitters`, `/api/sitters/[id]`, `/api/sitters/[id]/day-status/multi`) toutes 200 — contenu se charge correctement.
- Nuit au SEO (contenu non rendu pour les crawlers) et au LCP. Voir `docs/PERFORMANCE.md`.

### 8. `<p>DogShift</p>` orphelin dans le DOM — pages `/login` et `/signup`
- Un `<p>DogShift</p>` apparaît hors du conteneur principal dans le layout auth.
- Probablement le texte alt du logo qui "leak" hors du composant — à vérifier dans le layout auth.

### 9. Cookie dialog + PWA banner simultanés sur chaque page
- À chaque chargement, deux overlays s'empilent : dialog cookies + banner PWA "Installer l'application".
- Potentiel conflit de focus pour les utilisateurs clavier/screen reader.
- Le banner PWA s'affiche aussi sur desktop — à conditionner sur un `isMobile` check.

---

## 📋 Observations générales

| Pattern | Présence | Verdict |
|---|---|---|
| Cookie consent dialog | Toutes les pages | Normal (RGPD/nLPD), bien implémenté |
| PWA install banner | Toutes les pages | Normal mais intrusif sur desktop |
| DogShift Bot widget | Toutes les pages | Normal |
| 403 RSC `/login` | Toutes les pages | Bug Cloudflare (voir #1) |
| Footer | Toutes les pages | Cohérent — `/cgu`, `/confidentialite`, `/mentions-legales`, `/devenir-dogsitter` tous OK |
| Titres de page | Quasi-identiques | Presque toutes les pages ont `DogShift – Dog-sitting premium en Suisse` → problème SEO (titres non différenciés) |
| Pages légales | `/cgu`, `/confidentialite`, `/mentions-legales` | Toutes OK, zéro erreur console |

---

## Prochaines étapes

**Phase 3 (à faire)** — audit des flows authentifiés : dashboard sitter, tunnel de réservation owner, panel admin. Nécessite des credentials de test.
