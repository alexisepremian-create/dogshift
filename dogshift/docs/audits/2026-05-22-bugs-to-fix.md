# Bugs à corriger — Audit prod 2026-05-22

Consolidation des deux rapports d'audit (public + authentifié). À traiter dans l'ordre.

---

## 🔴 CRITIQUES

### C1 — Cloudflare bloque les RSC prefetch `/login`
- **Symptôme :** `GET /login?_rsc=<token>` → 403 sur toutes les pages du site (home, search, sitter profile, become-sitter…)
- **Cause :** Cloudflare "Managed Challenge" actif sur `/login` — les prefetch Next.js RSC ne passent pas le challenge JS
- **Impact :** Erreur console sur chaque page ; first navigation vers `/login` légèrement plus lente (pas de prefetch chaud)
- **Fix :** Dans Cloudflare dashboard → Security → WAF → whitelister les requêtes `?_rsc=` sur `/login` (ou désactiver le Managed Challenge sur cette route — Auth.js + bcrypt suffisent)
- **Fichiers :** Cloudflare dashboard uniquement (pas de code)
- [ ] À faire (suivi en bas du document)

---

## 🟡 IMPORTANTS

### I1 — `/signup` lien brisé vers `/politique-confidentialite`
- **Symptôme :** `GET /politique-confidentialite` → 404 au chargement de `/signup`
- **Cause :** URL incorrecte dans le composant signup — la bonne URL est `/confidentialite`
- **Fix :** Chercher `politique-confidentialite` dans `components/auth/SignUpForm.tsx` ou le layout signup et remplacer par `/confidentialite`
- **Fichiers :** `components/auth/SignUpForm.tsx` (ou équivalent)
- [ ] À faire (suivi en bas du document)

### I2 — Page 404 contient un lien `/support` → 404
- **Symptôme :** Sur chaque page 404, le template prefetch `/support` → 404 enfant
- **Fix :** Corriger le lien dans `app/not-found.tsx` — pointer vers une page existante (ex. `/contact` ou `/cgu` ou supprimer le lien)
- **Fichiers :** `app/not-found.tsx`
- [ ] À faire (suivi en bas du document)

### I3 — `/sitters` → 404 sans redirect
- **Symptôme :** URL `/sitters` tombe en 404 au lieu de rediriger vers `/search`
- **Impact :** Liens externes, bookmarks, SEO potentiellement brisés
- **Fix :** Ajouter une redirect 301 dans `next.config.js` ou `vercel.json` :
  ```json
  { "source": "/sitters", "destination": "/search", "permanent": true }
  ```
- **Fichiers :** `next.config.js` ou `vercel.json`
- [ ] À faire (suivi en bas du document)

### I4 — `GET /api/host/profile → 403` sur la page checkout (owner connecté)
- **Symptôme :** Requête `GET /api/host/profile` lancée sur `/checkout/[bookingId]` alors que l'utilisateur est un owner — endpoint réservé aux sitters → 403
- **Cause :** Probablement un hook ou composant partagé qui ne vérifie pas le rôle avant de fetch
- **Fix :** Chercher `fetch('/api/host/profile')` dans les composants du checkout et ajouter un guard sur le rôle
- **Fichiers :** À localiser dans `app/(protected)/checkout/` ou composants partagés
- [ ] À faire (suivi en bas du document)

### I5 — Bookings `PENDING_PAYMENT` invisibles dans `/account/bookings`
- **Symptôme :** Après création d'un booking avec paiement échoué, la page `/account/bookings` affiche "Aucune réservation pour le moment"
- **Impact :** L'owner ne peut pas voir ses tentatives échouées ni relancer le paiement
- **Fix :** Inclure les bookings `PENDING_PAYMENT` dans la liste avec un badge "En attente de paiement" + lien vers `/checkout/[id]`
- **Fichiers :** `app/api/account/bookings/route.ts` (query Prisma) + composant liste bookings
- [ ] À faire (suivi en bas du document)

### I6 — Banner CGU réapparaît après "Fermer" à chaque navigation
- **Symptôme :** Le banner "Nos CGU ont été mises à jour" réapparaît à chaque changement de page, même après avoir cliqué "Fermer"
- **Fix :** Stocker un flag dans `sessionStorage` après "Fermer" pour ne plus afficher le banner pour la session. "J'accepte" doit persister en DB, "Fermer" en session uniquement
- **Fichiers :** Composant banner CGU (à localiser — probablement `components/` ou layout)
- [ ] À faire (suivi en bas du document)

---

## 🟢 MINEURS (backlog)

### M1 — `<p>DogShift</p>` orphelin dans le DOM sur `/login` et `/signup`
- Texte alt du logo qui "leak" hors du composant — à vérifier dans le layout auth
- **Fichiers :** Layout auth (`app/(marketing)/login/` ou équivalent)
- [ ] À faire (suivi en bas du document)

### M2 — Cookie dialog + PWA banner simultanés sur chaque page (desktop)
- Deux overlays s'empilent : cookies + PWA "Installer l'application"
- Le banner PWA s'affiche aussi sur desktop
- **Fix :** Conditionner le banner PWA sur un `isMobile` check
- [ ] À faire (suivi en bas du document)

### M3 — Titres de page quasi-identiques (SEO)
- Presque toutes les pages ont `DogShift – Dog-sitting premium en Suisse`
- **Fix :** Titres différenciés par page dans les métadonnées Next.js
- [ ] À faire (suivi en bas du document)

### M4 — Formulaire réservation : aucun chien requis
- Le formulaire laisse procéder sans chien ajouté
- À clarifier : gate ou champ vraiment optionnel avec note explicite
- [ ] À faire (suivi en bas du document)

---

## 📋 Déjà fixés dans cette session / hors scope

- **Publish toggle iOS** — Fix appliqué dans PR #393 (2026-05-20). Cause résiduelle = Stripe gate silencieux (voir I5-bis dans bug fiches)
- **Emails Sysy Montreux** — Pas un bug, profil vraiment incomplet. Fix copy email `sitterOnboardingGuideEmail.tsx` séparé
- **Stripe paiement en prod** — Pas un bug, c'est la prod live. Besoin d'un environnement staging pour les audits E2E futurs

---

*Source : `docs/audits/2026-05-22-audit-prod-public.md` + `docs/audits/2026-05-22-audit-prod-authenticated.md`*

---

## ✅ Statut des corrections (2026-05-22)

| Bug | Statut | Fichier(s) modifié(s) | Notes |
|---|---|---|---|
| C1 — Cloudflare RSC `/login` 403 | ⏳ TODO | (Cloudflare dashboard, pas de code) | À faire dans WAF |
| I1 — `/politique-confidentialite` 404 | ✅ Fixé | `components/auth/SignUpForm.tsx` | href → `/confidentialite` |
| I2 — Page 404 → `/support` 404 | ✅ Fixé | `app/not-found.tsx` | href → `mailto:contact@dogshift.ch` |
| I3 — `/sitters` 404 | ✅ Fixé | `next.config.ts` | Redirect 301 → `/search` |
| I4 — `/api/host/profile` 403 owner | ✅ Fixé | `app/(marketing)/sitter/[sitterId]/page.tsx` | Skip fetch si role ≠ SITTER/ADMIN |
| I5 — `PENDING_PAYMENT` invisibles | ✅ Fixé | `app/api/account/bookings/route.ts` | API n'exclut plus que `DRAFT` ; détail booking a déjà bouton "Payer" |
| I6 — Banner CGU réapparaît | ✅ Fixé | `components/CguUpdateBanner.tsx` | sessionStorage `ds_cgu_dismissed_v` (versionné par CGU_VERSION) |
| M1–M4 — Mineurs | ⏳ Backlog | — | Pas urgents pour le lancement iOS |

**À faire avant `npm run ship` :**
1. Ajouter au moins un test de régression dans `tests/` (rule du repo, cf. CLAUDE.md « Bug-fix discipline ») — au minimum pour I1, I3, I5
2. Lancer `npm test` localement pour vérifier
3. `npm run dev` + smoke test manuel sur `/signup` (lien confidentialité), `/sitters` (redirect), `/account/bookings` (PENDING_PAYMENT visible)
4. `npm run ship -- "fix(audit): correctifs audit 2026-05-22 (I1–I6)"`

