# Bugs connus

## [OUVERT] Coordonnées GPS manquantes — Penthaz / Sydney (#1303)

**Statut** : Corrigé partiellement (fallback en place), root cause non résolue  
**Branches concernées** : `fix/map`, commits `087e74c` et `0c9abf0`  
**Fichier affecté** : `lib/` (coords de fallback hardcodées)

### Symptôme
La sitter Sydney, dont le profil est associé à la ville de Penthaz (NPA 1303), n'apparaissait pas sur la carte de la homepage et des pages de recherche. Le marqueur était absent.

### Cause
Le géocodage de "Penthaz" via MapTiler ne retournait pas de coordonnées valides pour ce village vaudois (population ~1500 hab, peu indexé). La colonne `SitterProfile.lat` / `SitterProfile.lng` restait `null` pour ce profil.

### Correctif appliqué
Ajout de coordonnées de fallback hardcodées pour Penthaz / NPA 1303 dans la lib côté root. Si `lat/lng` est null et que la ville correspond à "Penthaz" ou le NPA à "1303", des coordonnées fixes sont utilisées.

**Coordonnées de fallback** : `lat: 46.6297, lng: 6.5973` (centre de Penthaz, VD)

### Root cause non résolue
Le géocodeur MapTiler ne couvre pas tous les villages suisses avec la même précision. Le batch geocoding admin (`POST /api/admin/geocode-sitters`) devrait mettre à jour les coordonnées mais n'a pas résolu le cas Penthaz.

### Actions recommandées
- [ ] Vérifier si d'autres sitters dans des petites communes ont le même problème (`SELECT * FROM "SitterProfile" WHERE lat IS NULL AND published = true`)
- [ ] Envisager un fallback par NPA suisse (table de référence) plutôt qu'un fallback hardcodé par nom de ville
- [ ] Ou utiliser une API de géocodage suisse plus complète (geo.admin.ch)

---

## [RÉSOLU] Erreurs Clerk v7 silencieuses — Login / Signup email code

**Statut** : Corrigé  
**Branche** : `fix/clerk-v7-email-code-silent-errors`, commit `01351c3`  
**Fichiers affectés** : Pages login et signup, composants de vérification email

### Symptôme
Lors de la vérification email (code OTP envoyé par Clerk), les erreurs retournées par l'API Clerk v7 n'étaient pas affichées à l'utilisateur. Le formulaire restait silencieux en cas de code incorrect, expiré ou déjà utilisé.

### Cause
La migration vers Clerk v7 a changé la structure des erreurs retournées. Le code précédent lisait `err.errors[0].message` mais Clerk v7 retourne parfois des erreurs sous une forme différente. Les `catch` blocks ne remontaient pas l'erreur à l'état React.

### Correctif appliqué
- Ajout de `reportApiError()` dans les catch blocks des flows email code
- Utilisation de `lib/auth/clerkErrorMessage.ts` pour extraire le message lisible depuis la structure d'erreur Clerk v7
- Affichage correct des messages d'erreur dans l'UI

---

## [RÉSOLU] Régression mobile — Premier touch sur splash, modals, header (#78 / #79)

**Statut** : Revert appliqué (#79), puis recorrigé (#78)  
**Commits** : `de38b9a` (fix), `716502b` (revert), réintégré ultérieurement

### Symptôme
Sur mobile, le premier touch sur certains éléments interactifs (splash screen, modals, header) ne déclenchait pas l'action attendue. Il fallait toucher deux fois.

### Cause
Comportement iOS "ghost click" / délai de 300ms sur les éléments sans `touch-action: manipulation`. Une modification du layout root avait supprimé une règle CSS qui neutralisait ce délai.

### Correctif
Application de `touch-action: manipulation` sur les éléments concernés. Testé sur iOS Safari et Android Chrome.

---

## [SURVEILLANCE] Expiration des bookings PENDING_ACCEPTANCE

**Statut** : Implémenté, à surveiller en production  
**Route concernée** : `/api/cron/expire-pending-bookings`

### Description
Les réservations en statut `PENDING_ACCEPTANCE` (payées mais pas encore acceptées par le sitter) doivent expirer automatiquement après un délai configurable. Le cron job fait cela, mais il n'est pas dans `vercel.json` avec un schedule explicite — vérifier que le déploiement est bien configuré.

### Actions recommandées
- [ ] Confirmer que le cron est bien planifié en production Vercel
- [ ] Ajouter une alerte Sentry si le nombre de PENDING_ACCEPTANCE > seuil

---

## [SURVEILLANCE] Réconciliation des payouts Stripe

**Statut** : Implémenté via `/api/cron/reconcile-payouts`  
**Risque** : Divergence entre ledger interne et état Stripe réel si le cron échoue silencieusement

### Description
Le cron de libération des virements (`release-booking-payouts`) peut marquer un payout comme PAID dans la DB alors que le Transfer Stripe a échoué. Le cron de réconciliation (`reconcile-payouts`) détecte ces divergences.

### Actions recommandées
- [ ] Monitorer les alertes Sentry avec `error_kind: "payout_reconciliation_mismatch"`
- [ ] Vérifier les `BookingFinanceEvent` pour détecter des anomalies
