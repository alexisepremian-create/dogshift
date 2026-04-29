import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ====================================================================
// AGENT CANDIDATURE SITTER
// Remplace le workflow n8n "DogShift — Candidature Sitter"
// Reçoit les données candidature → score → décision → logs
// ====================================================================

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "977094430";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

type LinkAnimalProfessionSlug = 'none' | 'veterinarian' | 'asa' | 'breeder' | 'groomer' | 'trainer' | 'handler' | 'behaviorist' | 'shelter_volunteer' | 'other';
type GardeExperienceSlug = 'never' | 'occasional_family' | 'regular_lt_1y' | 'regular_1_3y' | 'extensive_3y_plus' | 'professional';
type Decision = 'HIGH' | 'REVIEW' | 'LOW';

const PROFESSION_LABELS: Record<string, string> = {
  none: 'Aucun (passion personnelle uniquement)',
  veterinarian: 'Vétérinaire / médecin vétérinaire',
  asa: 'ASA (assistant·e en soins vétérinaires)',
  breeder: 'Éleveur / éleveuse',
  groomer: 'Toiletteur / toiletteuse',
  trainer: 'Éducateur / dresseur canin',
  handler: 'Maître-chien / agent cynophile',
  behaviorist: 'Comportementaliste canin',
  shelter_volunteer: 'Bénévole en refuge / SPA',
  other: 'Autre métier animalier',
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
  'lausanne', 'renens', 'prilly', 'ecublens', 'crissier', 'chavannes pres renens',
  'bussigny', 'epalinges', 'le mont sur lausanne',
  'pully', 'lutry', 'cully', 'chexbres',
  'vevey', 'la tour de peilz', 'corsier sur vevey', 'st legier',
  'blonay', 'montreux', 'clarens', 'territet',
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

const EXP_KW = ['chien', 'chiens', 'chiot', 'chiots', 'canin', 'labrador', 'berger', 'husky', 'golden', 'malinois', 'promener', 'balade', 'garde', 'garder', 'education', 'obeissance', 'rappel', 'nourrir', 'soigner', 'brosser', 'voisin', 'famille', 'amis'];
const MOTIV_KW = ['long terme', 'serieux', 'professionnel', 'metier', 'carriere', 'revenu', 'passion', 'responsable', 'fiable', 'engagement', 'projet', 'developper', 'dogshift'];

function normalize(str: string): string {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isSwissPhone(phone: string): boolean {
  const p = phone.replace(/\s+/g, '');
  return /^(\+41|0041)[0-9]{9}$/.test(p) || /^0(7[5-9])[0-9]{7}$/.test(p);
}

interface ScoredApplication {
  score: number;
  decision: Decision;
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
}

function calculateScore(body: any): ScoredApplication {
  let score = 0;
  let hardBlock = false;

  const city = normalize(body.city);
  const cityOther = normalize(body.cityOther || '');
  const cityFinal = city === 'autre' ? cityOther : city;
  const npa = body.npa || '';
  const linkAnimalProfession = body.linkAnimalProfession || '';
  const gardeExperienceLevel = body.gardeExperienceLevel || '';
  const experience = normalize(body.experience || '');
  const motivation = normalize(body.motivation || '');
  const availabilityStructured = body.availabilityStructured || {};
  const gardeTypes = body.gardeTypes || [];
  const dogSizes = body.dogSizes || [];
  const hasCarLicense = body.hasCarLicense || false;
  const phoneRaw = (body.phone || '').replace(/\s+/g, '');
  const phoneOk = isSwissPhone(phoneRaw);

  // 📍 Localisation
  const npaInt = parseInt(npa, 10);
  const npaInZone = !isNaN(npaInt) && NPA_CIBLES_RANGES.some(r => npaInt >= r.min && npaInt <= r.max);
  const villeInZone = VILLES_CIBLES.some(v => cityFinal.includes(normalize(v)));

  if (npaInZone) score += 30;
  else if (villeInZone) score += 25;

  // 🎓 Métier
  const metierMatch = !!linkAnimalProfession && linkAnimalProfession !== 'none' && !!PROFESSION_LABELS[linkAnimalProfession];
  if (metierMatch) score += 15;

  // 🐶 Expérience
  score += GARDE_EXP_POINTS[gardeExperienceLevel] || 0;

  // 🔍 Texte expérience
  const expMatches = EXP_KW.filter(kw => experience.includes(kw)).length;
  if (expMatches >= 6) score += 5;
  else if (expMatches >= 4) score += 3;

  // 💬 Motivation
  const motivMatches = MOTIV_KW.filter(kw => motivation.includes(kw)).length;
  if (motivMatches >= 3) score += 10;
  else if (motivMatches >= 1) score += 5;

  // 📅 Disponibilités
  let joursEntiers = 0;
  let joursPartiels = 0;
  let fallbackJours = 0;

  const joursListe = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  joursListe.forEach(jour => {
    const slot = availabilityStructured[jour];
    if (!slot) return;
    if (slot.journeeEntiere || (slot.matin && slot.apresMidi)) joursEntiers++;
    else if (slot.matin || slot.apresMidi) joursPartiels++;
  });

  if (Array.isArray(body.availability)) {
    if (body.availability.includes('weekend')) fallbackJours += 2;
    if (body.availability.includes('evening')) fallbackJours += 1;
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
  if (!body.phone) hardBlock = true;
  if (!phoneOk) hardBlock = true;
  if (!npaInZone && !villeInZone) hardBlock = true;
  if (joursEntiers === 0 && fallbackJours === 0) hardBlock = true;
  if (gardeTypes.length === 0) hardBlock = true;

  // 🎯 Décision
  let decision: Decision = 'LOW';
  if (!hardBlock) {
    if (score >= 65 && joursEntiers >= 3) decision = 'HIGH';
    else if (score >= 45) decision = 'REVIEW';
  }

  // 🚩 Red flags
  const red_flags: string[] = [];
  if (!body.phone) red_flags.push('Pas de téléphone');
  if (!phoneOk) red_flags.push('Numéro non suisse');
  if (!npaInZone && !villeInZone) red_flags.push('Hors zone');
  if (joursEntiers < 3 && fallbackJours < 2) red_flags.push(`${joursEntiers} jour(s) entier(s) dispo`);
  if (gardeExperienceLevel === 'never' && !metierMatch) red_flags.push('Aucune expérience');
  if (gardeTypes.length === 0) red_flags.push('Aucun type de garde');
  if (dogSizes.length === 0) red_flags.push('Aucune taille de chien');

  // ⭐ Highlights
  const highlights: string[] = [];
  if (metierMatch) highlights.push(`🎓 ${PROFESSION_LABELS[linkAnimalProfession]}`);
  if (joursEntiers >= 3) highlights.push(`📅 ${joursEntiers} jours/semaine`);
  else if (fallbackJours >= 2) highlights.push('📅 Dispo week-end');
  if (hasCarLicense) highlights.push('🚗 Véhicule');
  if (phoneOk) highlights.push('🇨🇭 Téléphone CH');

  const summary = `Score ${score}/100 - ${decision} | ${joursEntiers} jours entiers${fallbackJours > 0 ? ` | fallback dispo: ${fallbackJours}` : ''}${!phoneOk ? ' | ⚠️ tel non CH' : ''}`;

  return {
    score, decision, summary, red_flags, highlights,
    joursEntiers, joursPartiels, fallbackJours,
    villeReconnue: villeInZone, npaInZone,
    metierAnimalier: metierMatch, telephoneSuisse: phoneOk,
  };
}

async function sendTelegram(text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' }),
    });
  } catch {}
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await req.json();
    const startTime = performance.now();

    // 1. Calculer le score / décision
    const result = calculateScore(body);

    // 2. Logger l'action
    await prisma.agentLog.create({
      data: {
        agentName: 'candidature',
        actionType: 'apply',
        summary: `Candidature ${body.firstName} ${body.lastName} → ${result.decision} (${result.score}/100)`,
        details: { email: body.email, decision: result.decision, score: result.score },
        targetId: body.applicationId || null,
        durationMs: Math.round(performance.now() - startTime),
        status: 'success',
      },
    });

    // 3. Envoyer notification Telegram (si score >= REVIEW)
    if (result.decision !== 'LOW') {
      const msg = `🐾 *Nouvelle candidature*\n👤 ${body.firstName} ${body.lastName}\n📍 ${body.city}\n📧 ${body.email}\n⭐ Score : ${result.score}/100\n🎯 Décision : ${result.decision}\n\n🔥 Points forts :\n${result.highlights.map(h => '• ' + h).join('\n')}\n\n⚠️ Red flags :\n${result.red_flags.map(r => '• ' + r).join('\n')}`;
      await sendTelegram(msg);
    }

    return NextResponse.json({
      success: true,
      agent: 'candidature',
      ...result,
      applicationId: body.applicationId,
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    await prisma.agentLog.create({
      data: {
        agentName: 'candidature',
        actionType: 'error',
        summary: `Erreur: ${(error as Error).message}`,
        details: { error: String(error) },
        durationMs,
        status: 'error',
      },
    });
    return NextResponse.json({ error: 'Candidature agent error', details: (error as Error).message }, { status: 500 });
  }
}