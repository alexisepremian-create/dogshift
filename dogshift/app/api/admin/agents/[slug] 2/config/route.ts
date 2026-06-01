import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestAdminAccess } from "@/lib/adminAuth";

export const runtime = "nodejs";

const SEED_DEFAULTS: Record<string, { label: string; description: string; cronSchedule?: string }> = {
  maestro:                  { label: "Maestro",           description: "Orchestrateur central" },
  candidature:              { label: "Candidature",       description: "Score automatique des candidatures sitters" },
  "candidature-ai-review":  { label: "Candidature IA",    description: "Analyse qualitative Claude des candidatures" },
  "candidature-enriched":   { label: "Candidature Enriched", description: "Orchestrateur candidature algo + IA" },
  availability:             { label: "Availability",      description: "Vérification des disponibilités sitters" },
  booking:                  { label: "Booking",           description: "Gestion des réservations" },
  notification:             { label: "Notification",      description: "Notifications in-app" },
  activation:               { label: "Activation",        description: "Onboarding nouveaux sitters" },
  calendrier:               { label: "Calendrier",        description: "Webhooks Cal.com" },
  contrat:                  { label: "Contrat",           description: "Envoi et signature des contrats" },
  supervision:              { label: "Supervision",       description: "Monitoring santé des agents" },
  "lead-magnet":            { label: "Lead Magnet",       description: "Capture emails lead magnet" },
  "onboarding-owner":       { label: "Onboarding Owner",  description: "Email de bienvenue propriétaires" },
  "relance-owner":          { label: "Relance Owner",     description: "Email de relance comportementale owners" },
  "zootherapie-evaluation": { label: "Zoothérapie",       description: "Évaluation bien-être personnalisée" },
  "cron-relance-owners":    { label: "Cron Relance",      description: "Surveillance owners sans réservation", cronSchedule: "0 */2 * * *" },
};

function getDefaults(slug: string) {
  return SEED_DEFAULTS[slug] ?? { label: slug, description: "Agent DogShift" };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const access = await getRequestAdminAccess(req);
  if (!access.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const defaults = getDefaults(slug);

  const config = await prisma.agentConfig.upsert({
    where: { slug },
    create: { slug, ...defaults, active: true, parameters: {} },
    update: {},
  });

  return NextResponse.json(config);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const access = await getRequestAdminAccess(req);
  if (!access.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.description !== undefined) data.description = String(body.description);
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.cronSchedule !== undefined) data.cronSchedule = body.cronSchedule === null ? null : String(body.cronSchedule);
  if (body.parameters !== undefined) data.parameters = body.parameters;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const config = await prisma.agentConfig.update({ where: { slug }, data });
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Config not found — call GET first to create it" }, { status: 404 });
  }
}
