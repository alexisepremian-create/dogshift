import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Notification Telegram enrichie (séparée de celle du Candidature Agent classique)
async function sendEnrichedTelegram(payload: {
  nom: string;
  scoreClassique: number;
  decisionClassique: string;
  niveauIA: string | null;
  scoreIA: number | null;
  recommandationIA: string | null;
  drapeauxRouges: string[];
}) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const lignes = [
    `🧠 *Analyse enrichie : ${payload.nom}*`,
    ``,
    `📊 Score classique : *${payload.scoreClassique}/100* — ${payload.decisionClassique}`,
  ];

  if (payload.niveauIA && payload.scoreIA !== null) {
    lignes.push(`🤖 Niveau IA : *${payload.niveauIA}* (${payload.scoreIA}/100)`);
  } else {
    lignes.push(`⚠️ Analyse IA indisponible`);
  }

  if (payload.recommandationIA) {
    lignes.push(``, `_${payload.recommandationIA}_`);
  }

  if (payload.drapeauxRouges.length > 0) {
    lignes.push(``, `🚩 Drapeaux rouges : ${payload.drapeauxRouges.join(', ')}`);
  }

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: lignes.join('\n'),
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('[candidature-enriched] Telegram failed:', err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Appels parallèles aux 2 agents
    // Promise.allSettled : si l'un plante, l'autre passe quand même
    const [classiqueResult, iaResult] = await Promise.allSettled([
      fetch(`${BASE_URL}/api/agents/candidature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),

      fetch(`${BASE_URL}/api/agents/candidature-ai-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    ]);

    // Extraction sûre du score classique (obligatoire — c'est notre fallback)
    if (classiqueResult.status !== 'fulfilled' || !classiqueResult.value?.success) {
      console.error('[candidature-enriched] Score classique a échoué:', classiqueResult);
      return NextResponse.json(
        {
          success: false,
          error: 'Le scoring classique a échoué',
          details: classiqueResult.status === 'fulfilled' ? classiqueResult.value : String(classiqueResult.reason),
        },
        { status: 500 }
      );
    }

    const classique = classiqueResult.value;

    // Extraction de l'IA (optionnelle — graceful degradation si elle plante)
    const iaSucceeded =
      iaResult.status === 'fulfilled' && iaResult.value?.success === true;
    const ia = iaSucceeded ? iaResult.value.analyse : null;

    if (!iaSucceeded) {
      console.warn(
        '[candidature-enriched] Analyse IA indisponible:',
        iaResult.status === 'fulfilled' ? iaResult.value : iaResult.reason
      );
    }

    // Notification Telegram enrichie
    await sendEnrichedTelegram({
      nom: body.nom || body.firstName || 'Candidat sans nom',
      scoreClassique: classique.score,
      decisionClassique: classique.decision,
      niveauIA: ia?.niveau ?? null,
      scoreIA: ia?.score_qualitatif ?? null,
      recommandationIA: ia?.recommandation ?? null,
      drapeauxRouges: ia?.drapeaux_rouges ?? [],
    });

    // Réponse fusionnée
    return NextResponse.json({
      success: true,
      agent: 'candidature-enriched',
      classique: {
        score: classique.score,
        decision: classique.decision,
        summary: classique.summary,
        red_flags: classique.red_flags,
        highlights: classique.highlights,
        joursEntiers: classique.joursEntiers,
        joursPartiels: classique.joursPartiels,
        villeReconnue: classique.villeReconnue,
        npaInZone: classique.npaInZone,
        metierAnimalier: classique.metierAnimalier,
        telephoneSuisse: classique.telephoneSuisse,
      },
      ia: ia
        ? {
            disponible: true,
            niveau: ia.niveau,
            score_qualitatif: ia.score_qualitatif,
            forces: ia.forces,
            points_attention: ia.points_attention,
            recommandation: ia.recommandation,
            drapeaux_rouges: ia.drapeaux_rouges,
          }
        : {
            disponible: false,
            raison: 'IA indisponible, voir logs serveur',
          },
      applicationId: classique.applicationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[candidature-enriched] Erreur fatale:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
