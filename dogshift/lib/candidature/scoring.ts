// ====================================================================
// CANDIDATURE SCORING — shared lib
// Called directly (no HTTP) from sitter-applications route.
// ====================================================================

export type CandidatureDecision = "HIGH" | "REVIEW" | "LOW";

export type CandidatureScore = {
  score: number;
  decision: CandidatureDecision;
  summary: string;
  red_flags: string[];
  highlights: string[];
  joursEntiers: number;
  joursPartiels: number;
  fallbackJours: number;
  villeReconnue: boolean;
  npaInZone: boolean;
  metierAnimalier: boolean;
  telephoneSuisse: boolean;
};

export type CandidatureScoringInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  cityOther?: string | null;
  npa?: string | null;
  linkAnimalProfession?: string | null;
  linkAnimalProfessionOther?: string | null;
  gardeExperienceLevel?: string | null;
  experience: string;
  motivation: string;
  availabilityStructured?: Record<string, { matin: boolean; apresMidi: boolean; journeeEntiere: boolean }> | null;
  gardeTypes?: string[];
  dogSizes?: string[];
  housingType?: string | null;
  hasCarLicense?: boolean | null;
  applicationId?: string;
};

const PROFESSION_LABELS: Record<string, string> = {
  none: "Aucun (passion personnelle uniquement)",
  veterinarian: "Vétérinaire / médecin vétérinaire",
  asa: "ASA (assistant·e en soins vétérinaires)",
  breeder: "Éleveur / éleveuse",
  groomer: "Toiletteur / toiletteuse",
  trainer: "Éducateur / dresseur canin",
  handler: "Maître-chien / agent cynophile",
  behaviorist: "Comportementaliste canin",
  shelter_volunteer: "Bénévole en refuge / SPA",
  other: "Autre métier animalier",
};

const GARDE_EXP_POINTS: Record<string, number> = {
  never: 0,
  occasional_family: 8,
  regular_lt_1y: 12,
  regular_1_3y: 16,
  extensive_3y_plus: 20,
  professional: 20,
};

const VILLES_CIBLES = [
  "lausanne", "renens", "prilly", "ecublens", "crissier", "chavannes pres renens",
  "bussigny", "epalinges", "le mont sur lausanne",
  "pully", "lutry", "cully", "chexbres",
  "vevey", "la tour de peilz", "corsier sur vevey", "st legier",
  "blonay", "montreux", "clarens", "territet",
];

const NPA_CIBLES_RANGES = [
  { min: 1000, max: 1018 },
  { min: 1020, max: 1024 },
  { min: 1030, max: 1033 },
  { min: 1052, max: 1053 },
  { min: 1066, max: 1066 },
  { min: 1090, max: 1095 },
  { min: 1096, max: 1098 },
  { min: 1800, max: 1820 },
];

const EXP_KW = [
  "chien", "chiens", "chiot", "chiots", "canin", "labrador", "berger", "husky",
  "golden", "malinois", "promener", "balade", "garde", "garder", "education",
  "obeissance", "rappel", "nourrir", "soigner", "brosser", "voisin", "famille", "amis",
];
const MOTIV_KW = [
  "long terme", "serieux", "professionnel", "metier", "carriere", "revenu", "passion",
  "responsable", "fiable", "engagement", "projet", "developper", "dogshift",
];

function normalize(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSwissPhone(phone: string): boolean {
  const p = phone.replace(/\s+/g, "");
  return /^(\+41|0041)[0-9]{9}$/.test(p) || /^0(7[5-9])[0-9]{7}$/.test(p);
}

export function calculateCandidatureScore(input: CandidatureScoringInput): CandidatureScore {
  let score = 0;
  let hardBlock = false;

  const city = normalize(input.city);
  const cityOther = normalize(input.cityOther || "");
  const cityFinal = city === "autre" ? cityOther : city;
  const npa = input.npa || "";
  const linkAnimalProfession = input.linkAnimalProfession || "";
  const gardeExperienceLevel = input.gardeExperienceLevel || "";
  const experience = normalize(input.experience || "");
  const motivation = normalize(input.motivation || "");
  const availabilityStructured = input.availabilityStructured || {};
  const gardeTypes = input.gardeTypes || [];
  const dogSizes = input.dogSizes || [];
  const hasCarLicense = input.hasCarLicense || false;
  const phoneRaw = (input.phone || "").replace(/\s+/g, "");
  const phoneOk = isSwissPhone(phoneRaw);

  // 📍 Localisation
  const npaInt = parseInt(npa, 10);
  const npaInZone =
    !isNaN(npaInt) && NPA_CIBLES_RANGES.some((r) => npaInt >= r.min && npaInt <= r.max);
  const villeInZone = VILLES_CIBLES.some((v) => cityFinal.includes(normalize(v)));

  if (npaInZone) score += 30;
  else if (villeInZone) score += 25;

  // 🎓 Métier
  const metierMatch =
    !!linkAnimalProfession &&
    linkAnimalProfession !== "none" &&
    !!PROFESSION_LABELS[linkAnimalProfession];
  if (metierMatch) score += 15;

  // 🐶 Expérience
  score += GARDE_EXP_POINTS[gardeExperienceLevel] || 0;

  // 🔍 Texte expérience
  const expMatches = EXP_KW.filter((kw) => experience.includes(kw)).length;
  if (expMatches >= 6) score += 5;
  else if (expMatches >= 4) score += 3;

  // 💬 Motivation
  const motivMatches = MOTIV_KW.filter((kw) => motivation.includes(kw)).length;
  if (motivMatches >= 3) score += 10;
  else if (motivMatches >= 1) score += 5;

  // 📅 Disponibilités
  let joursEntiers = 0;
  let joursPartiels = 0;
  const fallbackJours = 0;

  const joursListe = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  for (const jour of joursListe) {
    const slot = availabilityStructured[jour];
    if (!slot) continue;
    if (slot.journeeEntiere || (slot.matin && slot.apresMidi)) joursEntiers++;
    else if (slot.matin || slot.apresMidi) joursPartiels++;
  }

  if (joursEntiers >= 5) score += 15;
  else if (joursEntiers >= 3) score += 12;
  else if (joursEntiers >= 1) score += 6;
  else if (fallbackJours >= 2) score += 6;
  else if (fallbackJours >= 1) score += 3;
  else if (joursPartiels >= 3) score += 3;

  // 🚗 Véhicule
  if (hasCarLicense) score += 5;

  // 📞 Téléphone
  if (phoneOk) score += 5;
  else score -= 10;

  score = Math.max(0, Math.min(100, score));

  // ⛔ Hard block
  if (!input.phone) hardBlock = true;
  if (!phoneOk) hardBlock = true;
  if (!npaInZone && !villeInZone) hardBlock = true;
  if (joursEntiers === 0 && fallbackJours === 0) hardBlock = true;
  if (gardeTypes.length === 0) hardBlock = true;

  // 🎯 Décision
  let decision: CandidatureDecision = "LOW";
  if (!hardBlock) {
    if (score >= 65 && joursEntiers >= 3) decision = "HIGH";
    else if (score >= 45) decision = "REVIEW";
  }

  // 🚩 Red flags
  const red_flags: string[] = [];
  if (!input.phone) red_flags.push("Pas de téléphone");
  if (!phoneOk) red_flags.push("Numéro non suisse");
  if (!npaInZone && !villeInZone) red_flags.push("Hors zone");
  if (joursEntiers < 3 && fallbackJours < 2)
    red_flags.push(`${joursEntiers} jour(s) entier(s) dispo`);
  if (gardeExperienceLevel === "never" && !metierMatch)
    red_flags.push("Aucune expérience");
  if (gardeTypes.length === 0) red_flags.push("Aucun type de garde");
  if (dogSizes.length === 0) red_flags.push("Aucune taille de chien");

  // ⭐ Highlights
  const highlights: string[] = [];
  if (metierMatch) highlights.push(`🎓 ${PROFESSION_LABELS[linkAnimalProfession]}`);
  if (joursEntiers >= 3) highlights.push(`📅 ${joursEntiers} jours/semaine`);
  else if (fallbackJours >= 2) highlights.push("📅 Dispo week-end");
  if (hasCarLicense) highlights.push("🚗 Véhicule");
  if (phoneOk) highlights.push("🇨🇭 Téléphone CH");

  const summary = `Score ${score}/100 - ${decision} | ${joursEntiers} jours entiers${
    fallbackJours > 0 ? ` | fallback dispo: ${fallbackJours}` : ""
  }${!phoneOk ? " | ⚠️ tel non CH" : ""}`;

  return {
    score,
    decision,
    summary,
    red_flags,
    highlights,
    joursEntiers,
    joursPartiels,
    fallbackJours,
    villeReconnue: villeInZone,
    npaInZone,
    metierAnimalier: metierMatch,
    telephoneSuisse: phoneOk,
  };
}

export function buildCandidatureTelegramMessage(params: {
  firstName: string;
  lastName: string;
  city: string;
  email: string;
  result: CandidatureScore;
}): string {
  const { firstName, lastName, city, email, result } = params;
  return (
    `🐾 *Nouvelle candidature*\n` +
    `👤 ${firstName} ${lastName}\n` +
    `📍 ${city}\n` +
    `📧 ${email}\n` +
    `⭐ Score : ${result.score}/100\n` +
    `🎯 Décision : ${result.decision}\n\n` +
    `🔥 Points forts :\n${result.highlights.map((h) => "• " + h).join("\n") || "Aucun"}\n\n` +
    `⚠️ Red flags :\n${result.red_flags.map((r) => "• " + r).join("\n") || "Aucun"}`
  );
}
