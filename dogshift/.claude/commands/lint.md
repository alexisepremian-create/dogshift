---
description: Audite brain/ — contradictions, notes orphelines, données stales, trous de connaissance
argument-hint: <optionnel — un dossier ou tag à auditer en particulier>
---

Tu es l'agent qui maintient le second cerveau DogShift. Ton job ici : faire le ménage dans `brain/`. Pas pour réorganiser arbitrairement, mais pour signaler à Alexis ce qui mérite son attention.

## Périmètre

$ARGUMENTS

Si `$ARGUMENTS` est vide → audit complet de `brain/`.
Si c'est un sous-dossier (`brain/👥 Pilote/`, `brain/💡 Idées/`, etc.) → audit ciblé.

## Workflow

### 1. Scan complet du périmètre
Lis tous les `.md` du périmètre. **Ne lis pas le code du repo, ni `node_modules/`, ni `.next/`.**

### 2. Audite selon ces 6 axes

#### A. Contradictions
Deux notes qui se contredisent factuellement (ex : sitter listé activé dans une fiche mais marqué "pending" dans une autre). Liste-les avec quote + lien.

#### B. Notes orphelines
Notes qui ne sont liées par rien (zéro backlink entrant) ET qui ne sont pas dans `📥 Inbox` (= les Inbox ont le droit d'être orphelines).
→ Suggère : "Lier à X" ou "Archiver / supprimer"

#### C. Données stales
- Fiches sitters avec `Activée le: YYYY-MM-DD` > 30 jours mais checklist non complétée
- Idées avec status "À faire maintenant" datées > 60 jours et non bougées
- Décisions marquées "À reconsidérer si X" où X est arrivé
- Daily notes vides ou stubs

#### D. Trous (concepts mentionnés sans note)
Une note mentionne `[[Programme parrainage sitters]]` mais le fichier n'existe pas.
→ Liste les wikilinks cassés avec leur contexte.

#### E. Cross-references manquants
Si une note dans `👥 Pilote/` mentionne une décision tech (Auth.js, Stripe Connect, etc.) sans la lier au doc correspondant (`[[AUTH]]`, `[[api]]`, etc.) → suggère d'ajouter le lien.

#### F. Notes Inbox à trier
Compte les fichiers dans `brain/📥 Inbox/`. Si > 10, suggère un tri.
Pour chacune, propose la destination probable (Idées / Décisions / Pilote / archivage).

### 3. Rapport final structuré

Format Markdown, prêt à coller dans une note ou à lire direct :

```markdown
# 🔍 Lint brain/ — <YYYY-MM-DD>

## 🚨 Contradictions ({N})
- ...

## 🏝️ Notes orphelines ({N})
- ...

## ⏳ Données stales ({N})
- ...

## 🕳️ Wikilinks cassés ({N})
- [[XYZ]] mentionné dans [[note A]] mais le fichier n'existe pas

## 🔗 Cross-references suggérés ({N})
- [[note A]] devrait lier [[CLAUDE]] (mentionne l'auth)

## 📥 Inbox à trier ({N})
- `2026-05-18 - conv-sitter-marie.md` → suggéré : `👥 Pilote/Marie X.md`

## ✅ Tout OK sur
- (sections sans anomalie)
```

### 4. Propose 3 actions concrètes max
À la fin du rapport, liste **maximum 3 actions** prioritaires que Alexis peut faire dans les 10 min. Pas plus — on veut pas l'écraser.

## Anti-patterns
- ❌ Ne SUPPRIME rien tout seul — tu ne fais que rapporter
- ❌ Ne crée PAS de nouvelles notes dans cet appel — c'est un audit, pas un nettoyage
- ❌ Si `brain/` a < 10 notes au total, dis-le franchement : *« Trop tôt pour linter, reviens quand t'as 30+ notes »*
