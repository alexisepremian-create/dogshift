import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

// Schéma de la réponse structurée que Claude doit renvoyer
const CandidatureAnalysisSchema = z.object({
  niveau: z.enum(['PREMIUM', 'STANDARD', 'INSUFFISANT']),
  score_qualitatif: z.number().describe('Score qualitatif entre 0 et 100'),
  forces: z.array(z.string()).describe('Entre 1 et 3 forces principales du candidat'),
  points_attention: z.array(z.string()).describe('Maximum 3 points d\'attention'),
  recommandation: z.string(),
  drapeaux_rouges: z.array(z.string()),
});

export async function POST(req: Request) {
  try {
    const candidat = await req.json();

    // Validation minimale des données entrantes
    if (!candidat.nom || !candidat.email) {
      return NextResponse.json(
        { error: 'Données candidat incomplètes (nom et email requis)' },
        { status: 400 }
      );
    }

    const { object: analyse } = await generateObject({
      model: anthropic('claude-sonnet-4-5'),
      schema: CandidatureAnalysisSchema,
      system: `Tu es un expert en recrutement pour DogShift, plateforme dogsitting PREMIUM en Suisse romande (Lausanne, Riviera vaudoise).

CRITÈRES DE QUALITÉ PREMIUM :
- Expérience réelle avec les chiens (pro ou perso prolongée)
- Profil de confiance : profession stable, parcours cohérent
- Localisation idéale : Lausanne, Vevey, Montreux, Pully, Lutry, La Tour-de-Peilz
- Disponibilité claire et engagement dans la durée
- Communication soignée (français correct, message structuré)
- Sensibilité au bien-être animal

DRAPEAUX ROUGES :
- Motivation purement financière sans amour des chiens
- Profil instable (changements fréquents d'activité)
- Communication vague, fautes massives, ton non professionnel
- Hors zone géographique cible
- Absence d'expérience canine

NIVEAUX :
- PREMIUM : profil exceptionnel, à activer en priorité
- STANDARD : profil acceptable mais nécessite vérification approfondie
- INSUFFISANT : ne correspond pas au positionnement premium

Sois EXIGEANT. Mieux vaut refuser un bon candidat que d'accepter un médiocre.
Réponds toujours en français.`,
      prompt: `Analyse cette candidature de pet-sitter :

Nom : ${candidat.nom}
Email : ${candidat.email}
Téléphone : ${candidat.telephone || 'Non renseigné'}
Ville / NPA : ${candidat.ville || 'Non renseignée'} ${candidat.npa || ''}
Profession : ${candidat.profession || 'Non renseignée'}
Expérience avec les chiens : ${candidat.experience || 'Non renseignée'}
Disponibilités : ${candidat.disponibilite || 'Non renseignées'}
Services proposés : ${Array.isArray(candidat.services) ? candidat.services.join(', ') : candidat.services || 'Non renseignés'}
Message de motivation : ${candidat.message || candidat.motivation || 'Aucun message'}

Donne ton analyse complète selon le schéma demandé.`,
    });

    return NextResponse.json({
      success: true,
      candidat: { nom: candidat.nom, email: candidat.email },
      analyse,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[candidature-ai-review] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
