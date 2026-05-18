---
description: Archive la conversation actuelle (ou un extrait) comme une note structurée dans brain/
argument-hint: <optionnel — slug ou catégorie (idée|décision|pilote|inbox)>
---

Tu es l'agent qui maintient le second cerveau DogShift. L'utilisateur (Alexis) veut sauver une partie de notre conversation actuelle pour ne pas la perdre. Ton job : la transformer en note Obsidian propre dans `brain/`.

## Hint

$ARGUMENTS

## Workflow

### 1. Détermine la portée à sauver
- Si Alexis a précisé un sujet (ex: `/save l'idée du parrainage`) → sauve juste ça
- Sinon → propose-lui 2-3 candidats *« Je peux sauver : (a) ta question + ma réponse sur X, (b) la décision qu'on a prise sur Y, (c) la liste de bugs trouvés sur Z. Lequel ? »*

### 2. Détermine la catégorie cible

Selon le contenu de ce qu'on sauve :

| Type de contenu | Destination |
|---|---|
| Idée feature / produit / marketing | `brain/💡 Idées/<titre>.md` (template `idée.md`) |
| Décision technique ou business avec trade-offs | `brain/🧠 Décisions/<titre>.md` (template `décision.md`) |
| Info sur un sitter spécifique | `brain/👥 Pilote/<Prénom Ville>.md` (template `sitter.md`) |
| Post-mortem de bug / leçon technique | `brain/🧠 Décisions/<titre>.md` |
| Réflexion ouverte / brouillon | `brain/📥 Inbox/<YYYY-MM-DD> - <slug>.md` |

Si le hint contient une catégorie (`/save idée Programme parrainage`) → respecte-la.

### 3. Génère un titre & slug
- Titre humain, court, en français
- Slug = kebab-case du titre, sans accents si possible (Obsidian gère bien les accents mais évite les `:` `/` `?` dans les noms de fichiers)

### 4. Écris la note
- Utilise le template approprié si applicable
- Réécris le contenu de la conversation au **passé** et de manière neutre (« On a décidé que X parce que Y », pas « tu m'as dit que X »)
- Ajoute en haut un bloc :
  ```
  > Sauvegardé depuis une session Claude le <YYYY-MM-DD>
  > Contexte : <1-2 lignes pour situer>
  ```
- Termine par une section `## Liens` avec des wikilinks vers les notes existantes mentionnées (`[[Sonia Morges]]`, `[[AUTH]]`, etc.)

### 5. Mentionne dans le journal du jour
Ajoute une ligne à `brain/📓 Journal/<YYYY-MM-DD>.md` du style :
- *Sauvegardé note [[Programme parrainage sitters]] depuis session Claude*

Si la daily du jour n'existe pas, crée-la avec le template `brain/⚙️ Templates/daily.md`.

### 6. Rapport
Annonce à Alexis le chemin du fichier créé et ce qu'il contient en 1 ligne.

## Anti-patterns
- ❌ Ne **copie pas** les messages mot à mot — synthétise au passé, en français neutre
- ❌ Ne crée PAS de fichier `wiki/syntheses/` — utilise les dossiers existants
- ❌ Ne **leak pas** de secrets / clés / mots de passe / activation codes — masque-les (`DS-****-****`, `sk_live_****`)
- ❌ Si la conversation contient des emails de sitters / users, c'est OK de les garder (c'est dans `brain/` qui est gitignored)
- ❌ Ne crée PAS de notes vides ou de stubs — si y a rien d'utile à sauver, dis-le franchement
