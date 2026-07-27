# Un service publié sans aucune disponibilité → « Pension » affichée, chaque date UNAVAILABLE

**Status:** Fixed (juillet 2026)

## Symptom

Une propriétaire ouvre la fiche d'une dogsitter (Sonia B.), voit **Pension** dans
les services proposés, sélectionne n'importe quelle date → « indisponible ».
Toutes les dates, tous les mois. Aucun message d'erreur : le service existe,
il est simplement injouable.

## Root cause

Trois défauts qui se combinent.

### 1. `ServiceConfig.create` sans les colonnes Int obligatoires

`ServiceConfig` n'a **aucun `@default` Prisma** pour `slotStepMin`,
`minDurationMin`, `maxDurationMin`, `leadTimeMin`, `bufferBeforeMin`,
`bufferAfterMin`. Deux payloads de création les omettaient :

- `lib/sitter/serviceSync.ts` → `syncSitterServices()`
- `app/api/host/profile/pricing/route.ts` → désactivation d'un service sans tarif

Dès qu'un sitter n'avait pas ses 3 lignes `ServiceConfig`, la branche `create`
levait `PrismaClientValidationError`, ce qui **rollback toute la transaction** de
`syncSitterServices`. Et l'appelant (`POST /api/host/profile`) avale l'erreur
(`catch` + `console.error`, volontairement non bloquant). Résultat : ces sitters
ne pouvaient **jamais** être resynchronisés. En prod, 2 sitters n'avaient que 2
lignes sur 3.

### 2. Les trois sources de vérité divergent

`SitterProfile.services` disait `["Promenade"]` ; `ServiceConfig` disait
`{PROMENADE: true, DOGSITTING: true, PENSION: true}`. Comme
`resolvePublicEnabledServices` donne la priorité à `ServiceConfig`, la fiche
publique annonçait Garde **et** Pension — alors que la sitter n'avait de règles
de disponibilité que pour Promenade (7 règles ; 0 pour les deux autres).

### 3. Aucun garde-fou serveur sur l'écriture de disponibilités

`PUT /api/sitters/me/availability-rules` et `POST|PUT
/api/sitters/me/availability-exceptions` ne vérifiaient que le tarif
(`PRICING_REQUIRED`). Pire : ils **créaient** une ligne `ServiceConfig` avec
`enabled: true` en effet de bord — écrire une disponibilité pouvait donc activer
un service silencieusement. Le dashboard bloquait déjà l'édition
(`canEditAvailabilityForTab`), mais l'API non.

## Fix

Nouveau module `lib/availability/serviceActivation.ts`, propriétaire des deux
règles de l'invariant :

1. **On ne peut pas poser de disponibilité sur un service non activé.**
   `assertServiceEnabledOrThrow()` → `SERVICE_DISABLED` 400 sur les 3 routes
   d'écriture. Il matérialise aussi la ligne `ServiceConfig` manquante (avec
   `SERVICE_DEFAULTS`), ce qui remplace les auto-créations inline supprimées.
2. **Un service activé mais sans aucune disponibilité n'est pas réservable →
   on ne l'annonce pas.** `loadBookableServiceTypes()` (2 `groupBy` batchés :
   règles + exceptions à venir) alimente le nouveau paramètre optionnel
   `bookableServiceTypes` de `resolvePublicEnabledServices`. Câblé sur les 3
   points d'entrée publics : `/api/sitters`, `/api/sitters/[sitterId]`,
   homepage `getFeaturedSitters`.

Plus :

- `SERVICE_DEFAULTS` ajouté aux deux `create` cassés (cause racine n° 1).
- Message FR pour `SERVICE_DISABLED` dans `lib/errors/apiErrorMessage.ts`.
- Bandeau dashboard : « Ce service est activé mais tu n'as encore aucune
  disponibilité : il reste masqué pour les propriétaires. »
- `scripts/repair-sitter-services.ts` — dry-run par défaut, `--apply` pour
  soigner les sitters déjà abîmés en prod.

## What NOT to do again

- **Ne jamais écrire un `serviceConfig.create` sans `...SERVICE_DEFAULTS[serviceType]`.**
  Prisma n'a pas de défaut pour 6 colonnes Int ; l'oubli fait throw la branche
  `create` d'un `upsert`, et donc rollback toute la transaction autour.
- **Ne pas re-créer d'auto-activation implicite** (« j'écris une dispo donc
  j'active le service »). L'activation est un geste explicite du sitter dans
  Services & tarifs.
- **Une ligne `ServiceConfig` absente veut dire ACTIVÉ**, pas désactivé — le
  moteur de créneaux lit `config?.enabled ?? true`. Toute lecture qui inverse ça
  dépublie silencieusement les sitters historiques.
- **Ne pas ajouter de garde-fou uniquement côté UI.** Le dashboard bloquait déjà
  l'édition d'un service désactivé ; l'API l'acceptait. C'est l'API qui compte.

## Related

- `lib/availability/serviceActivation.ts` (le module d'invariant)
- `lib/sitter/serviceSync.ts` (les 3 sources de vérité)
- `lib/sitterEnabledServices.ts` (résolution publique)
- `scripts/repair-sitter-services.ts` (réparation prod)
- `tests/availability/serviceActivation.test.ts`
- `docs/bugs/sitter-completion-array-vs-record-shape.md` (même classe de dérive)

## 🤖 Automated detection

```json
{
  "type": "sql",
  "description": "Aucun sitter publié ne doit avoir un service activé sans la moindre disponibilité (règle ou exception à venir).",
  "query": "SELECT COUNT(*)::int AS value FROM \"ServiceConfig\" sc JOIN \"User\" u ON u.\"sitterId\" = sc.\"sitterId\" JOIN \"SitterProfile\" sp ON sp.\"userId\" = u.id WHERE sc.enabled = true AND sp.published = true AND NOT EXISTS (SELECT 1 FROM \"AvailabilityRule\" ar WHERE ar.\"sitterId\" = sc.\"sitterId\" AND ar.\"serviceType\" = sc.\"serviceType\" AND ar.status IN ('AVAILABLE','ON_REQUEST')) AND NOT EXISTS (SELECT 1 FROM \"AvailabilityException\" ae WHERE ae.\"sitterId\" = sc.\"sitterId\" AND ae.\"serviceType\" = sc.\"serviceType\" AND ae.status IN ('AVAILABLE','ON_REQUEST') AND ae.date >= CURRENT_DATE)",
  "expect_max": 0,
  "auto_fix": { "complexity": "complex" }
}
```
