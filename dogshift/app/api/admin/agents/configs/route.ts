import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestAdminAccess } from "@/lib/adminAuth";

export const runtime = "nodejs";

const ALL_SEEDS: { slug: string; label: string; description: string; cronSchedule?: string }[] = [
  { slug: "maestro",                label: "Maestro",            description: "Orchestrateur central" },
  { slug: "candidature",            label: "Candidature",        description: "Score automatique des candidatures sitters" },
  { slug: "candidature-ai-review",  label: "Candidature IA",     description: "Analyse qualitative Claude des candidatures" },
  { slug: "candidature-enriched",   label: "Candidature Enriched", description: "Orchestrateur candidature algo + IA" },
  { slug: "availability",           label: "Availability",       description: "Vérification des disponibilités sitters" },
  { slug: "booking",                label: "Booking",            description: "Gestion des réservations" },
  { slug: "notification",           label: "Notification",       description: "Notifications in-app" },
  { slug: "activation",             label: "Activation",         description: "Onboarding nouveaux sitters" },
  { slug: "calendrier",             label: "Calendrier",         description: "Webhooks Cal.com" },
  { slug: "contrat",                label: "Contrat",            description: "Envoi et signature des contrats" },
  { slug: "supervision",            label: "Supervision",        description: "Monitoring santé des agents" },
  { slug: "lead-magnet",            label: "Lead Magnet",        description: "Capture emails lead magnet" },
  { slug: "onboarding-owner",       label: "Onboarding Owner",   description: "Email de bienvenue propriétaires" },
  { slug: "relance-owner",          label: "Relance Owner",      description: "Email de relance comportementale owners" },
  { slug: "zootherapie-evaluation", label: "Zoothérapie",        description: "Évaluation bien-être personnalisée" },
  { slug: "cron-relance-owners",    label: "Cron Relance",       description: "Surveillance owners sans réservation", cronSchedule: "0 */2 * * *" },
  { slug: "pension-verification",   label: "Pension Vérification", description: "Analyse IA des photos de logement pour l'activation de la Pension" },
];

export async function GET(req: NextRequest) {
  const access = await getRequestAdminAccess(req);
  if (!access.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Upsert any missing seeds (create-only, never overwrite existing)
  await Promise.allSettled(
    ALL_SEEDS.map((seed) =>
      prisma.agentConfig.upsert({
        where: { slug: seed.slug },
        create: { ...seed, active: true, parameters: {} },
        update: {},
      })
    )
  );

  const configs = await prisma.agentConfig.findMany({ orderBy: { slug: "asc" } });
  return NextResponse.json({ configs });
}
