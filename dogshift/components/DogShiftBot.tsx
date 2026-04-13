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
  const hay = normalize(input);
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
        // ── Qu'est-ce que DogShift ───────────────────────────────────────────
        {
          keywords: [
            "c'est quoi", "cest quoi", "qu'est ce", "quest ce", "comment ca marche",
            "comment fonctionne", "dogshift", "plateforme", "site", "application",
            "appli", "service", "principe", "kesako", "kesakeuf",
          ],
          answer:
            "DogShift est une plateforme premium de dogsitting en France. Elle met en relation les propriétaires de chiens avec des dogsitters vérifiés pour 3 services : Promenade, Garde à domicile et Pension chez le sitter. Vous comparez les profils, les avis et réservez en ligne.",
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
            "dans ma ville", "disponible chez moi", "couverture", "france",
          ],
          answer:
            "DogShift couvre les principales villes françaises. Entrez votre ville dans la recherche pour voir les sitters disponibles près de chez vous. Le nombre de profils varie selon les zones — de nouvelles villes sont ajoutées régulièrement.",
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
