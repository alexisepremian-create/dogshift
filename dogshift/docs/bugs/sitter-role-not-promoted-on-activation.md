# Une dogsitter publiée avec `role = OWNER` → avenant de contrat jamais affiché

**Status:** Fixed (juillet 2026)

## Symptom

Dans `/admin/impersonate`, Sonia B. affiche le badge **owner** alors que la
colonne « Profil sitter » dit « Morges · publié ». Sa fiche est en ligne, elle
reçoit des réservations, mais elle est traitée comme une propriétaire par tout
le code qui teste `User.role`.

Conséquences constatées, de la plus grave à la plus cosmétique :

| Impact | Où |
|---|---|
| 🔴 La modale bloquante d'avenant au contrat ne s'affiche jamais pour elle (conformité) | `app/(marketing)/account/page.tsx` |
| 🔴 Depuis l'admin, « Détail → » l'envoie sur `/admin/owners/<id>` au lieu de sa fiche sitter | `app/(protected)/admin/users/page.tsx` |
| 🟡 Elle n'est pas redirigée hors du formulaire de candidature et peut re-postuler | `app/(marketing)/become-sitter/form/page.tsx` |
| 🟡 Le compteur « Sitters » de l'admin la manque, le filtre « Sitters » ne la retourne pas | `admin/users`, `admin/impersonate` |
| 🟡 `PUT /api/availability` et `PUT /api/sitter/availability` lui répondraient 403 | les deux routes (aucun appelant aujourd'hui) |

En prod : **3 sitters activés** avaient `role = OWNER`, dont 1 publiée.

## Root cause

`role: "SITTER"` n'était écrit qu'à **deux** endroits :

- `POST /api/become-sitter/apply`
- `POST /api/role/make-sitter` (admin, protégé par `DOGSHIFT_ADMIN_SECRET`)

L'activation — `POST /api/host/activation-code`, l'étape qui fait réellement de
quelqu'un un sitter — basculait `SitterProfile.lifecycleStatus` à `activated` et
posait `activatedAt`, **sans jamais toucher `User.role`**. Tout sitter arrivé par
un autre chemin que le formulaire de candidature restait `OWNER` pour toujours.

Le fond du problème est qu'il existait trois façons concurrentes de répondre à
« est-ce que cet utilisateur est un sitter ? » — `User.role`, l'existence d'un
`SitterProfile`, et `lifecycleStatus === "activated"` — et que chaque appelant
choisissait la sienne. `/api/auth/resolve-redirect` lisait le lifecycle en
priorité (donc Sonia atterrissait bien sur `/host`), pendant que la page
`/account` lisait le rôle seul (donc pas de modale d'avenant).

## Fix

Nouveau module `lib/sitter/sitterRole.ts`, propriétaire des deux règles :

1. **L'activation promeut le rôle.** `promoteUserToSitterRole()` est appelé dans
   `POST /api/host/activation-code`. Scopé en `updateMany({ where: { role: "OWNER" } })`
   pour être idempotent et incapable de rétrograder un ADMIN.
2. **Une autorisation ne fait jamais confiance au rôle seul.** `hasSitterSide()`
   est la lecture canonique : un `SitterProfile` publié / activé fait de toi un
   sitter quoi que dise la colonne. `sitterSideWhere()` est le fragment Prisma
   équivalent pour les filtres.

Câblé sur : la modale d'avenant (`/account`), `detailHref()` + compteurs +
`RoleBadge` de `/admin/users`, le filtre + badge de `/admin/impersonate`, et les
deux gardes `requireSitterUser` des routes availability.

`scripts/repair-sitter-roles.ts` (dry-run par défaut) promeut les comptes prod
déjà abîmés.

## What NOT to do again

- **Ne pas gater une autorisation sur `role === "SITTER"`.** Utiliser
  `hasSitterSide()` (ou `isSitterRecord()` côté candidature). Le rôle est un
  raccourci d'affichage, pas la vérité.
- **Ne pas non plus gater sur la simple existence d'un `SitterProfile`** : la
  ligne existe dès la candidature, bien avant l'activation. C'est l'erreur
  symétrique.
- **Toute étape qui fait de quelqu'un un sitter doit appeler
  `promoteUserToSitterRole()`.** Si un nouveau chemin d'onboarding apparaît, le
  rôle repartira en dérive.
- **Attention en resserrant `/become-sitter/form`** : un sitter fraîchement
  activé a maintenant `role = SITTER` mais doit encore remplir le formulaire.
  La redirection tient compte du cookie `ds_activation_profile_id`.
- `/api/debug-session` signalait déjà l'anomalie (`ACTIVATED_BUT_ROLE_NOT_SITTER`)
  — personne ne la lisait. D'où la détection automatique ci-dessous.

## Related

- `lib/sitter/sitterRole.ts` (le module d'invariant)
- `lib/sitterApplication/existingSitter.ts` → `isSitterRecord()` (même logique, côté candidature)
- `lib/auth/requireSitterOwner.ts` (garde correcte : ne lit jamais le rôle)
- `scripts/repair-sitter-roles.ts` (réparation prod)
- `tests/auth/sitterRole.test.ts`
- `docs/bugs/service-availability-desync.md` (même sitter, même classe de dérive)

## 🤖 Automated detection

```json
{
  "type": "sql",
  "description": "Aucun sitter activé ou publié ne doit rester avec User.role = 'OWNER'.",
  "query": "SELECT COUNT(*)::int AS value FROM \"User\" u JOIN \"SitterProfile\" sp ON sp.\"userId\" = u.id WHERE u.role = 'OWNER' AND (sp.published = true OR sp.\"activatedAt\" IS NOT NULL OR sp.\"lifecycleStatus\" = 'activated')",
  "expect_max": 0,
  "auto_fix": { "complexity": "simple" }
}
```
