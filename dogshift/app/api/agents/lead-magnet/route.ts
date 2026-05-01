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

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "977094430";

async function sendTelegram(text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    });
  } catch {}
}

export async function POST(req: NextRequest) {
  const guard = await checkAgentActive("lead-magnet");
  if (guard) return guard;

  const start = Date.now();
  try {
    const body = await req.json();
    const { email, prenom, source = "homepage_banner" } = body as {
      email?: string;
      prenom?: string;
      source?: string;
    };

    if (!email) {
      return NextResponse.json({ error: "email requis" }, { status: 400 });
    }

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

    await sendEmail({
      to: email,
      subject: "Votre guide DogShift est arrivé 🐾",
      text,
      html,
    });

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
