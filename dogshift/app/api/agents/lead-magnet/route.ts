import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkAgentActive } from "@/lib/agent-guard";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";

// ====================================================================
// AGENT LEAD MAGNET
// Triggered when a visitor submits their email via the lead magnet banner.
// Checks for duplicates, saves to DB, sends welcome email, logs + Telegram.
// ====================================================================

import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

async function sendTelegram(text: string) {
  await sendTelegramMessage(text, { bot: "relances" }).catch(() => {});
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`lead-magnet:${getClientIp(req)}`, { limit: 3, windowMs: 60 * 60 * 1000 }).allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  const guard = await checkAgentActive("lead-magnet");
  if (guard) return guard;

  const start = Date.now();
  try {
    const parsed = z.object({
      email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
      prenom: z.string().trim().max(80).optional(),
      source: z.enum(["homepage_banner", "chatbot"]).default("homepage_banner"),
    }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    const { email, prenom, source } = parsed.data;

    // 1. Check for duplicate
    const existing = await prisma.leadMagnet.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ success: false, reason: "already_exists" });
    }

    // 2. Save to DB
    await prisma.leadMagnet.create({
      data: { email, prenom: prenom ?? null, source },
    });

    // 3. Send welcome email
    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "https://dogshift.ch"
    ).replace(/\/$/, "");

    const { html } = renderEmailLayout({
      title: "Votre guide DogShift est arrivé 🐾",
      subtitle: prenom
        ? `Bonjour ${prenom}, merci pour votre confiance !`
        : "Merci pour votre confiance !",
      summaryTitle: "Ce que vous allez découvrir",
      summaryRows: [
        { label: "Erreur #1", value: "Ne pas vérifier les références du dog-sitter" },
        { label: "Erreur #2", value: "Choisir uniquement sur le prix" },
        { label: "Erreur #3", value: "Sauter la rencontre préalable chien/sitter" },
        { label: "Erreur #4", value: "Oublier les informations médicales" },
        { label: "Erreur #5", value: "Ne pas définir les routines et attentes" },
      ],
      ctaLabel: "Lire le guide complet →",
      ctaUrl: `${baseUrl}/guide-dogsitter`,
      secondaryLinkLabel: "Trouver un dog-sitter vérifié sur DogShift",
      secondaryLinkUrl: `${baseUrl}/search`,
      footerText:
        "Vous recevez cet email car vous avez demandé notre guide gratuit sur dogshift.ch. " +
        "DogShift • support@dogshift.ch",
      footerLinks: [{ label: "dogshift.ch", url: baseUrl }],
    });

    const text =
      `Votre guide DogShift est arrivé !\n\n` +
      `Accédez au guide : ${baseUrl}/guide-dogsitter\n\n` +
      `— L'équipe DogShift\nsupport@dogshift.ch\n`;

    await sendEmail(
      {
        to: email,
        subject: "Votre guide DogShift est arrivé 🐾",
        text,
        html,
      },
      {
        templateName: "lead-magnet-guide",
        context: "agent:lead-magnet",
        metadata: { source },
      },
    );

    // 4. Log
    await prisma.agentLog.create({
      data: {
        agentName: "lead-magnet",
        actionType: "email_captured",
        summary: `Lead capturé : ${email} (source: ${source})`,
        details: { email, prenom: prenom ?? null, source },
        durationMs: Date.now() - start,
        status: "success",
      },
    });

    // 5. Telegram
    await sendTelegram(`📧 Nouveau lead magnet : ${email} (${source})`);

    return NextResponse.json({ success: true, agent: "lead-magnet" });
  } catch (error) {
    const durationMs = Date.now() - start;
    await prisma.agentLog
      .create({
        data: {
          agentName: "lead-magnet",
          actionType: "error",
          summary: `Erreur: ${(error as Error).message}`,
          details: { error: String(error) },
          durationMs,
          status: "error",
        },
      })
      .catch(() => {});
    return NextResponse.json({ error: "Lead magnet agent error" }, { status: 500 });
  }
}
