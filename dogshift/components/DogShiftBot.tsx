"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, X } from "lucide-react";

type Role = "user" | "bot";

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  ts: number;
};

const STORAGE_KEY = "dogshift:bot:v1";

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['']/g, "'")
    .trim();
}

const ABBREVS: [RegExp, string][] = [
  // ── Combinaisons complètes en premier (ordre important) ──────────────────
  [/\bt\s*ki\b/g, "t'es qui"],
  [/\bt\s*qui\b/g, "t'es qui"],
  [/\bt\s*koi\b/g, "t'es quoi"],
  [/\bt\s*quoi\b/g, "t'es quoi"],
  [/\bc\s*ki\b/g, "c'est qui"],
  [/\bc\s*koi\b/g, "c'est quoi"],
  [/\bc\s*quoi\b/g, "c'est quoi"],
  [/\bc\s*qui\b/g, "c'est qui"],
  [/\bkesk\b/g, "qu'est ce que"],
  [/\bkeskon\b/g, "qu'est ce qu'on"],
  // ── Lettres / syllabes seules ────────────────────────────────────────────
  [/\bki\b/g, "qui"],
  [/\bkoi\b/g, "quoi"],
  // "c" seul uniquement (ni suivi d'une lettre, ni d'une apostrophe)
  [/\bc(?!['\w])/g, "c'est"],
  // "t" seul uniquement (ni suivi d'une lettre, ni d'une apostrophe)
  [/\bt(?!['\w])/g, "t'es"],
  [/\bpk\b/g, "pourquoi"],
  [/\bpq\b/g, "pourquoi"],
  [/\bpr\b/g, "pour"],
  [/\bqd\b/g, "quand"],
  [/\bdc\b/g, "donc"],
  [/\bms\b/g, "mais"],
  [/\bav\b/g, "avec"],
  [/\bss\b/g, "sans"],
  // ── Expressions & interjections ──────────────────────────────────────────
  [/\bsvp\b/g, "s'il vous plait"],
  [/\bstp\b/g, "s'il te plait"],
  [/\btjr(s)?\b/g, "toujours"],
  [/\bptet\b/g, "peut etre"],
  [/\bptetre\b/g, "peut etre"],
  [/\bqq\b/g, "quelque"],
  [/\bqqch\b/g, "quelque chose"],
  [/\bqn\b/g, "quelqu'un"],
  [/\bvlm\b/g, "vraiment"],
  [/\bvrmt\b/g, "vraiment"],
  [/\bpls\b/g, "plusieurs"],
  [/\bdsl\b/g, "désolé"],
  [/\bamha\b/g, "a mon avis"],
  [/\bama\b/g, "a mon avis"],
  [/\bjsp\b/g, "je sais pas"],
  // ── Salutations abrégées ─────────────────────────────────────────────────
  [/\bbjr\b/g, "bonjour"],
  [/\bbsr\b/g, "bonsoir"],
  [/\bslt\b/g, "salut"],
  [/\bcc\b/g, "coucou"],
  [/\ba\+\+?\b/g, "a plus"],
  [/\bap\b/g, "a plus"],
];

function expandAbbrevs(s: string): string {
  let out = s;
  for (const [pattern, replacement] of ABBREVS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function prepareInput(raw: string): string {
  return expandAbbrevs(normalize(raw));
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function fuzzyWordMatch(word: string, keyword: string): boolean {
  if (word.includes(keyword) || keyword.includes(word)) return true;
  if (keyword.length <= 3) return word === keyword;
  const maxDist = keyword.length <= 5 ? 1 : keyword.length <= 8 ? 2 : 3;
  return levenshtein(word, keyword) <= maxDist;
}

function scoreMatch(input: string, keywords: string[]) {
  const hay = prepareInput(input);
  const words = hay.split(/\s+/);
  let score = 0;
  for (const kRaw of keywords) {
    const k = normalize(kRaw);
    if (hay.includes(k)) {
      score += 2;
      continue;
    }
    if (k.includes(" ")) continue;
    if (words.some((w) => fuzzyWordMatch(w, k))) score += 1;
  }
  return score;
}

function DogRobotIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8.6 6.1 6.3 4.6c-.5-.3-1.1-.1-1.4.4-.2.4-.2.9.1 1.3l1.7 2.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.4 6.1 17.7 4.6c.5-.3 1.1-.1 1.4.4.2.4.2.9-.1 1.3l-1.7 2.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 3v1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M12 5.2c-3.7 0-6.7 2.9-6.7 6.6v2.2c0 3.7 3 6.6 6.7 6.6s6.7-2.9 6.7-6.6v-2.2c0-3.7-3-6.6-6.7-6.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.2h.2M14.6 12.2h.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.1 14.9c.9.7 2.9.7 3.8 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M7.4 9.5h9.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".55"
      />
    </svg>
  );
}

export default function DogShiftBot() {
  const faq = useMemo(
    () =>
      [
        // ── Salutations ──────────────────────────────────────────────────────
        {
          keywords: [
            "salut", "bonjour", "bonsoir", "hello", "hey", "coucou", "hi",
            "yo", "wesh", "slt", "bjr", "bsr", "allo", "allô", "cc",
            "bonne journee", "bonne soiree", "bonne matin",
          ],
          answer:
            "Bonjour ! 👋 Ravi de vous accueillir sur DogShift. Qu'est-ce que je peux faire pour vous ?",
        },
        // ── Comment ça va ────────────────────────────────────────────────────
        {
          keywords: [
            "ca va", "ça va", "comment ca va", "comment vas tu", "comment allez vous",
            "ca roule", "ca baigne", "la forme", "cv", "t va", "tu vas bien",
            "quoi de neuf", "quoi de 9", "koi de 9",
          ],
          answer:
            "Très bien merci, je suis prêt à vous aider ! 😊 Posez-moi vos questions sur DogShift : services, réservation, tarifs, devenir sitter… Je suis là pour vous.",
        },
        // ── Tu fais quoi / Qui es-tu (bot) ──────────────────────────────────
        {
          keywords: [
            "t'es qui", "tu es qui", "tes qui", "t ki", "t qui",
            "tu fais quoi", "tfq", "t fais quoi", "tu fous quoi",
            "c'est quoi toi", "t'es koi", "t es koi",
            "tu peux faire quoi", "tu sais faire quoi", "tes capacites",
            "tu connais quoi", "tu reponds a quoi", "t'es capable de quoi",
            "tu es un bot", "t'es un bot", "t'es un robot", "t'es humain",
            "tu es humain", "t'es une ia", "intelligence artificielle",
            "tu es reel", "t'es reel", "tu existes",
          ],
          answer:
            "Je suis DogShift Bot 🐾 — l'assistant virtuel de DogShift ! Je suis là pour répondre à toutes vos questions 24h/24 : services (Promenade, Garde, Pension), réservation, tarifs, phase pilote, sécurité, devenir dogsitter… Posez-moi n'importe quelle question !",
        },
        // ── Rires / Humour ───────────────────────────────────────────────────
        {
          keywords: [
            "lol", "mdr", "ptdr", "xd", "haha", "hihi", "hehe", "😂", "🤣",
            "trop drole", "trop marrant", "c'est drole", "hahaha", "lmao",
          ],
          answer:
            "😄 Haha ! Je suis un bot, mais j'ai de l'humour ! Si vous avez une vraie question sur DogShift, je suis là. Sinon, bonne journée !",
        },
        // ── Fondateur / Équipe ───────────────────────────────────────────────
        {
          keywords: [
            "fondateur", "createur", "créateur", "qui a cree", "qui a créé",
            "qui a fait le site", "qui a lance", "qui a lancé", "qui est derriere",
            "derriere dogshift", "derrière dogshift", "equipe dogshift", "équipe dogshift",
            "qui dirige", "ceo", "patron", "boss", "chef du site", "team dogshift",
            "qui gere le site", "qui a monte dogshift", "qui a monté dogshift",
            "c'est qui le fondateur", "c'est qui le createur",
            "c qui le fondateur", "c qui fondateur", "c qui le createur",
          ],
          answer:
            "Bonne question… mais qui cherche trouve 🐾😏 Ce que je peux dire, c'est que DogShift est un projet indépendant, construit avec passion et exigence pour offrir la meilleure expérience de dogsitting en Suisse. La suite ? Elle se mérite !",
        },
        // ── Remerciements ────────────────────────────────────────────────────
        {
          keywords: [
            "merci", "merci beaucoup", "thanks", "thank you", "super merci",
            "parfait merci", "ok merci", "cool merci", "sympa merci",
          ],
          answer:
            "Avec plaisir ! 😊 N'hésitez pas si vous avez d'autres questions. Bonne expérience sur DogShift !",
        },
        // ── Validation / Accord ──────────────────────────────────────────────
        {
          keywords: [
            "ok", "okay", "d'accord", "daccord", "oui", "ouais", "ouep",
            "parfait", "nickel", "top", "super", "genial", "excellent",
            "c'est bon", "ca marche", "cool", "bien compris", "j'ai compris",
          ],
          answer:
            "Super ! 👍 Si vous avez d'autres questions sur DogShift, n'hésitez pas — je suis là !",
        },
        // ── Phase pilote ─────────────────────────────────────────────────────
        {
          keywords: [
            "phase pilote", "pilote", "pilot", "beta", "lancement", "en cours de lancement",
            "pas encore disponible", "bientot disponible", "bientôt", "quand ca ouvre",
            "quand vous ouvrez", "c'est ouvert", "c'est disponible", "deja ouvert",
            "déjà ouvert", "c'est lance", "c'est lancé", "disponible quand",
            "liste attente", "liste d'attente", "m'inscrire pour le lancement",
            "comment ca marche phase", "comment ça marche phase",
          ],
          answer:
            "DogShift est actuellement en phase pilote 🚀 La plateforme est active sur la Riviera (entre Lausanne et Montreux), avec un nombre volontairement limité de dogsitters sélectionnés avec soin. L'expansion vers Genève, Nyon, Morges et d'autres villes est en cours progressivement.",
        },
        {
          keywords: [
            "commission", "combien vous prenez", "frais plateforme", "frais dogshift",
            "pourcentage", "part dogshift", "frais service", "frais supplementaire",
            "zero commission", "0 commission", "gratuit pour sitter",
          ],
          answer:
            "Durant la phase pilote, DogShift applique 0% de commission : les dogsitters conservent 100% du montant des réservations (hors frais Stripe). C'est l'un des avantages d'être parmi les premiers sitters à rejoindre la plateforme.",
        },
        {
          keywords: [
            "tarif encadre", "tarifs encadrés", "grille tarifaire", "fourchette sitter",
            "combien sitter gagne", "combien le sitter gagne", "prix minimum", "prix maximum",
            "tarif minimum", "tarif maximum", "entre combien", "tarif pilote",
          ],
          answer:
            "En phase pilote, les tarifs sont encadrés pour garantir la qualité et la cohérence : Promenade entre CHF 15 et 25, Garde à domicile entre CHF 18 et 30. Chaque sitter fixe son tarif dans cette fourchette selon son expérience.",
        },
        {
          keywords: [
            "selection sitter", "sélection sitter", "comment sitter est selectionne",
            "comment sitter est choisi", "criterees sitter", "critères sitter",
            "verifie comment", "processus selection", "rigoureux", "processus candidature",
            "casier judiciaire", "background check sitter", "qui peut devenir sitter",
          ],
          answer:
            "Les dogsitters DogShift sont sélectionnés manuellement avec exigence : vérification du profil, expérience avec les animaux, casier judiciaire vierge et entretien. Le nombre de sitters est volontairement limité pour garantir un niveau de qualité élevé dès le lancement.",
        },
        {
          keywords: [
            "contribuer", "soutenir", "don", "financement", "investir", "investissement",
            "contribuer lancement", "soutenir lancement", "aider dogshift",
            "participer lancement", "crowdfunding", "financement participatif",
          ],
          answer:
            "DogShift est construit de manière indépendante et responsable. Si vous souhaitez soutenir le lancement de la plateforme, vous pouvez contribuer volontairement via le bouton « Contribuer au lancement » en bas du site. Merci pour votre confiance !",
        },
        // ── Qu'est-ce que DogShift ───────────────────────────────────────────
        {
          keywords: [
            "c'est quoi", "cest quoi", "qu'est ce", "quest ce", "comment ca marche",
            "comment fonctionne", "dogshift", "plateforme", "site", "application",
            "appli", "service", "principe", "kesako", "kesakeuf",
          ],
          answer:
            "DogShift est une plateforme premium de dogsitting en Suisse. Elle met en relation les propriétaires de chiens avec des dogsitters vérifiés pour 3 services : Promenade, Garde à domicile et Pension chez le sitter. Vous comparez les profils, les avis et réservez en ligne.",
        },
        // ── Promenade ───────────────────────────────────────────────────────
        {
          keywords: [
            "promenade", "promener", "balade", "balader", "sortie", "sortir",
            "marche", "tour", "walk", "durée promenade", "temps promenade",
            "combien de temps promenade", "promennade", "promenad",
          ],
          answer:
            "La Promenade : un sitter qualifié vient chez vous chercher votre chien et le promène (durée et fréquence définies selon l'annonce). Idéal pour les journées chargées ou les propriétaires peu disponibles.",
        },
        // ── Garde à domicile ────────────────────────────────────────────────
        {
          keywords: [
            "garde", "visite", "a domicile", "chez moi", "passage", "check in",
            "check", "surveiller", "surveille", "garder chez moi",
            "sitter vient", "sitter passe", "sans hebergement", "sans nuit",
          ],
          answer:
            "La Garde / Visite à domicile : le sitter se déplace chez vous pour nourrir, sortir et s'occuper de votre chien, sans hébergement. Parfait pour les courtes absences ou la journée.",
        },
        // ── Pension ─────────────────────────────────────────────────────────
        {
          keywords: [
            "pension", "hebergement", "nuit", "nuits", "chez le sitter",
            "accueil", "accueilli", "famille", "dormir", "week end",
            "week-end", "vacances", "voyage", "partir", "absent",
            "logement", "loger", "pention", "penscion",
          ],
          answer:
            "La Pension (hébergement) : votre chien est accueilli directement chez le sitter — souvent dans un cadre familial et chaleureux. Idéal pour les week-ends, vacances ou déplacements prolongés.",
        },
        // ── Tarifs / Prix ───────────────────────────────────────────────────
        {
          keywords: [
            "prix", "tarif", "tarifs", "combien", "cout", "coute", "coût",
            "cher", "payer", "paiement", "budget", "facturation", "facture",
            "gratuit", "abordable", "remboursement", "rembouser", "remboursé",
            "fourchette", "grille", "plage de prix", "fourchete",
          ],
          answer:
            "Les tarifs varient selon le service, la durée et le sitter. Sur DogShift, chaque profil affiche clairement ses prix : vous pouvez comparer et choisir selon votre budget avant de réserver. Aucun frais caché.",
        },
        // ── Réservation ─────────────────────────────────────────────────────
        {
          keywords: [
            "reserver", "reservation", "comment reserver", "etapes", "demarche",
            "disponible", "disponibilite", "creneaux", "créneau", "calendrier",
            "choisir", "selectionner", "trouver un sitter", "chercher sitter",
            "book", "booker", "reserevation", "comment ca marche pour reserver",
          ],
          answer:
            "Pour réserver sur DogShift : 1) Choisissez votre service (Promenade, Garde ou Pension) + votre ville. 2) Parcourez les profils disponibles et comparez les avis. 3) Contactez le sitter et confirmez les détails. 4) Réservez en ligne en toute sécurité.",
        },
        // ── Compte / Inscription ─────────────────────────────────────────────
        {
          keywords: [
            "creer compte", "créer compte", "inscription", "inscrire",
            "connexion", "connecter", "login", "mot de passe", "email",
            "profil", "mon compte", "compte", "register", "enregistrer",
            "s'inscrire", "sincrire", "m'inscrire",
          ],
          answer:
            "Pour créer votre compte DogShift : cliquez sur « S'inscrire » en haut de la page. L'inscription est rapide et gratuite. Vous pouvez ensuite compléter votre profil et effectuer vos réservations.",
        },
        // ── Annulation / Modification ────────────────────────────────────────
        {
          keywords: [
            "annulation", "annuler", "annule", "modifier", "changer", "report",
            "reporter", "repousser", "decaler", "décaler", "changement",
            "remboursement annulation", "politique annulation", "annulaion",
          ],
          answer:
            "Annulation ou modification : les conditions dépendent du sitter et du service choisi. Consultez la politique d'annulation sur la fiche du sitter. En cas de besoin urgent, contactez le sitter directement via la messagerie DogShift.",
        },
        // ── Sécurité / Confiance ─────────────────────────────────────────────
        {
          keywords: [
            "securite", "securise", "confiance", "fiable", "fiabilite",
            "avis", "note", "notation", "verification", "verifier",
            "verifie", "certifie", "certifié", "references", "reference",
            "background check", "controle", "vetting", "assurance",
            "garantie", "protege", "sécurisé", "credible", "credibilite",
          ],
          answer:
            "Sur DogShift, chaque sitter dispose d'un profil avec avis clients vérifiés, expériences et photos. Vous pouvez échanger avec le sitter avant la garde pour évaluer votre compatibilité. Les profils vérifiés sont mis en avant pour votre sérénité.",
        },
        // ── Chien / Races / Tailles ──────────────────────────────────────────
        {
          keywords: [
            "race", "races", "taille", "grand chien", "petit chien",
            "gros chien", "chiot", "vieux chien", "vieille chien",
            "senior", "berger", "labrador", "bulldog", "golden",
            "accepted", "accepté", "accepte", "toutes races",
            "chien handicapé", "handicape",
          ],
          answer:
            "La plupart des sitters DogShift acceptent toutes les races et tailles. Certains ont des préférences (précisées sur leur profil). En cas de doute, consultez la fiche du sitter ou contactez-le directement avant de réserver.",
        },
        // ── Besoins spéciaux / Médicaments ───────────────────────────────────
        {
          keywords: [
            "medicament", "médicament", "traitement", "allergie", "allergique",
            "regime", "régime", "special", "spécial", "besoin particulier",
            "malade", "maladie", "vieillissant", "diabete", "diabétique",
            "soin", "soins", "veterinaire", "vétérinaire",
          ],
          answer:
            "Si votre chien a des besoins particuliers (médicaments, régime, soins), précisez-le dans votre demande et échangez avec le sitter avant la réservation. Certains sitters sont spécialement formés pour les animaux à besoins spécifiques.",
        },
        // ── Problème pendant la garde ────────────────────────────────────────
        {
          keywords: [
            "probleme pendant", "accident", "blessure", "blessé", "urgence",
            "veterinaire urgence", "que faire si", "perdu", "fugue", "fugué",
            "disparu", "chien disparu", "incident", "que se passe",
            "que se passe-t-il", "en cas de", "souci", "soucis",
          ],
          answer:
            "En cas d'incident pendant la garde, le sitter doit vous contacter immédiatement via la messagerie DogShift. En cas d'urgence vétérinaire, il se rend chez le vétérinaire le plus proche. Pensez à communiquer au sitter les coordonnées de votre vétérinaire habituel.",
        },
        // ── Zone géographique ────────────────────────────────────────────────
        {
          keywords: [
            "ville", "villes", "region", "région", "disponible ou", "disponible dans",
            "disponible a", "disponible en", "paris", "lyon", "marseille",
            "bordeaux", "toulouse", "nantes", "zone", "zones", "partout",
            "dans ma ville", "disponible chez moi", "couverture", "suisse",
          ],
          answer:
            "DogShift couvre les principales villes suisses (Lausanne, Genève, Zurich, Berne, Bâle…). Entrez votre ville dans la recherche pour voir les sitters disponibles près de chez vous. De nouvelles villes sont ajoutées régulièrement.",
        },
        // ── Urgence / Dernière minute ────────────────────────────────────────
        {
          keywords: [
            "urgent", "urgence", "derniere minute", "dernier minute",
            "aujourd'hui", "aujourd hui", "ce soir", "demain",
            "tres rapide", "rapide", "immédiat", "immediat", "vite",
            "dispo maintenant", "maintenant",
          ],
          answer:
            "Besoin d'un sitter en urgence ? Filtrez par disponibilité dans la recherche — certains sitters acceptent les réservations de dernière minute. Contactez-les directement via la messagerie pour une réponse rapide.",
        },
        // ── Devenir dogsitter ────────────────────────────────────────────────
        {
          keywords: [
            "devenir dogsitter", "devenir sitter", "proposer mes services",
            "rejoindre", "m'inscrire comme sitter", "offre", "proposer",
            "sitter moi meme", "travailler", "gagner argent", "revenu",
            "revenus complementaires", "side job", "candidater",
            "comment devenir", "commencer a garder",
          ],
          answer:
            "Devenir dogsitter DogShift : c'est gratuit et rapide ! Cliquez sur « Candidater maintenant », créez votre profil sitter, définissez vos services, tarifs et disponibilités. Vous recevrez ensuite des demandes de propriétaires près de chez vous.",
        },
        // ── Support / Bug ────────────────────────────────────────────────────
        {
          keywords: [
            "contact", "contacter", "support", "aide", "bug", "probleme",
            "erreur", "marche pas", "fonctionne pas", "bloque", "bloqué",
            "signaler", "rapport", "message d'erreur", "page blanche",
            "ne charge pas", "chargement", "lent",
          ],
          answer:
            "Besoin d'aide technique ? Décrivez le problème (page concernée, message d'erreur, action effectuée) et je vous aide. Pour contacter l'équipe DogShift directement, utilisez le formulaire de contact disponible en bas du site.",
        },
      ],
    []
  );

  const initialBotMessage: ChatMessage = useMemo(
    () => ({
      id: nowId(),
      role: "bot",
      text:
        "Bonjour ! Je suis DogShift Bot 🐾 Je peux répondre à vos questions sur nos services (Promenade, Garde, Pension), la réservation, les tarifs, la sécurité, devenir sitter… Posez-moi n'importe quelle question !",
      ts: Date.now(),
    }),
    []
  );

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([initialBotMessage]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { messages?: ChatMessage[] };
      if (parsed?.messages?.length) setMessages(parsed.messages);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages }));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function getBotReply(userText: string) {
    const scored = faq
      .map((item) => ({ item, score: scoreMatch(userText, [...item.keywords]) }))
      .sort((a, b) => b.score - a.score);

    if (scored[0]?.score > 0) return scored[0].item.answer;

    return (
      "Je n'ai pas bien compris votre question 🙏 Je peux vous renseigner sur : les services (Promenade, Garde, Pension), la réservation, les tarifs, la sécurité, votre compte, devenir dogsitter, ou les disponibilités. Reformulez et je ferai de mon mieux !"
    );
  }

  function send() {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = { id: nowId(), role: "user", text, ts: Date.now() };
    const botMsg: ChatMessage = {
      id: nowId(),
      role: "bot",
      text: getBotReply(text),
      ts: Date.now() + 1,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput("");
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 hidden md:block">
      {open ? (
        <div className="w-[360px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-[0_24px_80px_-50px_rgba(2,6,23,0.65)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--dogshift-blue)] shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_65%)] ring-1 ring-white/15">
                <DogRobotIcon className="h-5 w-5 text-white" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900">DogShift Bot</p>
                <p className="text-xs font-medium text-slate-500">Assistant virtuel</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-2xl text-slate-700 transition hover:bg-white/70 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              aria-label="Fermer DogShift Bot"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="max-h-[380px] overflow-auto px-4 py-3">
            <div className="flex flex-col gap-2">
              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={isUser ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        isUser
                          ? "max-w-[85%] rounded-2xl bg-[var(--dogshift-blue)] px-3 py-2 text-sm font-medium text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)]"
                          : "max-w-[85%] rounded-2xl bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200/60"
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200/70 p-3">
            <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-slate-200/60">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Posez votre question…"
                className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
                aria-label="Message pour DogShift Bot"
              />
              <button
                type="button"
                onClick={send}
                className="grid h-9 w-9 flex-none place-items-center rounded-2xl bg-[var(--dogshift-blue)] text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group mt-3 inline-flex h-14 items-center gap-3 rounded-3xl bg-[var(--dogshift-blue)] pl-4 pr-5 text-white shadow-[0_18px_60px_-40px_rgba(2,6,23,0.75)] ring-1 ring-white/15 transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
          aria-label="Ouvrir DogShift Bot"
        >
          <DogRobotIcon className="h-7 w-7 text-white transition group-hover:scale-[1.03]" />
          <span className="hidden select-none text-xs font-semibold text-white sm:inline">
            Posez-moi une question
          </span>
        </button>
      ) : null}
    </div>
  );
}
