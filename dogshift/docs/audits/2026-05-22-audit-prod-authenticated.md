# Audit prod — flows authentifiés (Phase 3)
**Date :** 2026-05-22  
**Scope :** flows authentifiés — owner booking, sitter dashboard, logout, forgot password.  
**Méthode :** Playwright headless sur `https://www.dogshift.ch` (prod). Carte Stripe test rejetée car la prod est en mode **live**.  
**Comptes testés :**
- Owner : mariedupont.shift@gmail.com  
- Sitter : alexis.epremian@gmail.com

---

## Récapitulatif des flows

| Flow | Résultat | Notes |
|---|---|---|
| 1. Login owner | ✅ | Redirect `/post-login` → `/account` |
| 1. Recherche sitter | ✅ | 10 sitters chargés, filtres visibles |
| 1. Fiche sitter + formulaire réservation | ✅ | Tous les champs fonctionnels |
| 1. Booking créé | ✅ | ID `cmpgk28940002l604chtz4c65` créé en DB |
| 1. Paiement Stripe | 🔴 | Stripe en mode LIVE → carte test refusée |
| 2. Login sitter | ✅ | Redirect → `/host` |
| 2. Dashboard sitter | ✅ | Stats, profil 75%, vérifié |
| 2. Demandes entrantes | ✅ | Vide (normal, pas de booking payé) |
| 2. Wallet | ✅ | Charge sans erreur |
| 3. Logout owner | ✅ | → `/login`, stable, pas de bounce |
| 3. Logout sitter | ✅ | → `/login`, stable, pas de bounce |
| 4. Forgot password | ✅ | Anti-leak correct, expire 1h |

---

## 🔴 BUGS CRITIQUES

### 1. Stripe en mode LIVE sur prod — test impossible avec carte test
- **Symptôme :** `POST stripe.com/v1/payment_intents/[id]/confirm → 400` + message "Votre demande a été faite en mode production, mais a utilisé une carte de test connue."
- **Impact :** Impossible de tester le funnel de paiement complet sur prod sans une vraie carte.
- **Comportement attendu :** correct pour la prod live. Ce n'est pas un bug en soi, mais ça **bloque les tests E2E authentifiés** sur prod. Il faut un environnement de staging avec les clés Stripe test pour pouvoir boucler le flow paiement → confirmation → sitter notification.
- **À faire :** Configurer un environnement de staging (preview Vercel accessible + `STRIPE_SECRET_KEY` test) pour les audits futurs.

---

## 🟡 BUGS IMPORTANTS

### 2. `GET /api/host/profile → 403` sur la page checkout (owner connecté)
- **Route :** `https://www.dogshift.ch/checkout/[bookingId]`
- **Symptôme :** Requête `GET /api/host/profile` lancée par le composant checkout alors que l'utilisateur connecté est un **owner** (pas sitter). L'endpoint `/api/host/*` est réservé aux sitters → 403 attendu, mais la requête ne devrait pas être lancée du tout pour un owner.
- **Impact :** Erreur console à chaque chargement du checkout par un owner. Peut masquer de vraies erreurs dans les logs Sentry.
- **À investiguer :** Chercher l'appel `fetch('/api/host/profile')` dans les composants du checkout — probablement un hook ou composant partagé qui ne vérifie pas le rôle avant de fetch.

### 3. Booking en statut `PENDING_PAYMENT` invisible dans `/account/bookings`
- **Symptôme :** Après avoir créé un booking et échoué au paiement, la page `/account/bookings` affiche "Aucune réservation pour le moment." Le booking existe en DB (ID confirmé).
- **Impact :** L'owner ne peut pas voir ses tentatives de paiement échouées ni les relancer. Si Stripe échoue et que l'owner revient plus tard, il ne retrouve pas sa demande en cours.
- **Fix suggéré :** Inclure les bookings `PENDING_PAYMENT` dans la liste avec un badge "En attente de paiement" + lien direct vers `/checkout/[id]`.

### 4. Banner CGU "Mises à jour" réapparaît sur chaque page après "Fermer"
- **Symptôme :** Sur chaque changement de page dans le dashboard owner (account → search → sitter profile → checkout), le banner "Nos CGU ont été mises à jour" réapparaît, même après avoir cliqué "Fermer" sur la page précédente.
- **Impact :** Expérience très dégradée — le banner est intrusif et bloque la lecture à chaque navigation.
- **Fix :** Mettre un flag en `sessionStorage` après "Fermer" pour ne plus afficher le banner pour la session en cours. "J'accepte" doit persister en DB, "Fermer" doit persister en session.

---

## 🟢 PROBLÈMES MINEURS (backlog)

### 5. Pas de chien requis pour compléter une réservation
- Le formulaire de réservation affiche "Vous n'avez pas encore ajouté de chien" avec un lien "Ajouter mon chien →" mais laisse procéder sans chien.
- Le sitter reçoit donc une notification sans fiche chien. Comportement voulu ou manque de validation ?
- À clarifier : gate sur l'existence d'un chien, ou rendre le champ vraiment optionnel avec une note explicite.

### 6. Profil sitter à 75% — non publié
- Le compte sitter test `alexis.epremian@gmail.com` a un profil à 75%, non publié (pas de photo de profil).
- Pour un audit sitter complet, il faudra un compte sitter publié à 100% avec des disponibilités configurées et un booking payé existant.

### 7. Dashboard sitter — lien "En savoir plus" → `/help`
- Le lien dans le dashboard sitter pointe vers `/help` qui existe (page "Centre d'aide" complète). ✅ Non un bug.

---

## 📋 Observations générales

**Ce qui fonctionne bien :**
- Toutes les redirections post-login sont correctes (owner → `/account`, sitter → `/host`)
- Toute la mécanique du formulaire de réservation est solide : datepicker, service selector, time picker, durée, location — tous fonctionnels
- Le warning "last-minute" (< 24h) est correctement affiché et disparaît quand on choisit le lendemain
- Le récap Stripe (CHF 20.00) est correct avant le paiement
- TWINT est l'option Stripe par défaut (cohérent avec le marché suisse)
- Apple Pay est disponible dans le checkout ✓
- Logout propre sur les deux comptes, pas de bounce regression
- Forgot password : anti-leak correct, TTL 1h mentionné dans l'UI
- `/help` existe et a du contenu ("Centre d'aide")

**Limites de cet audit :**
- Paiement Stripe live non testable avec carte test → la confirmation de booking, l'email de confirmation, la notification Telegram "réservation", et l'acceptation sitter n'ont pas pu être vérifiés
- Compte sitter test non publié → impossible de tester le flow "owner voit le sitter dans les résultats de recherche → sitter reçoit une demande → accepte" sur le même compte

---

## Prochaines étapes recommandées

1. **Créer un environnement staging** avec clés Stripe test pour boucler le flow paiement → webhook → confirmation
2. **Fixer le 403 `/api/host/profile`** sur le checkout (bug #2)
3. **Rendre les bookings `PENDING_PAYMENT` visibles** dans le dashboard owner (bug #3)
4. **Fixer le comportement du banner CGU** (sessionStorage après Fermer) (bug #4)
5. Compléter le profil sitter test à 100% pour la Phase 3 bis
