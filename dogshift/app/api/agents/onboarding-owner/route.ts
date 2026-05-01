import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";

// ====================================================================
// AGENT ONBOARDING OWNER
// Triggered on first login of a new owner (resolve-redirect, created:true).
// Sends a welcome email and schedules a J+3 follow-up reminder.
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
  const start = Date.now();
  try {
    const body = await req.json();
    const { email, prenom, userId } = body as {
      email?: string;
      prenom?: string;
      userId?: string;
    };

    if (!email || !userId) {
      return NextResponse.json({ error: "email et userId requis" }, { status: 400 });
    }

    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "https://dogshift.ch"
    ).replace(/\/$/, "");

    const greeting = prenom
      ? `Bienvenue sur DogShift, ${prenom} 🐶`
      : "Bienvenue sur DogShift 🐶";

    // 1. Send welcome email
    const { html } = renderEmailLayout({
      title: greeting,
      subtitle: "Trouvez le dog-sitter idéal pour votre compagnon en toute sérénité.",
      summaryTitle: "Pourquoi choisir DogShift ?",
      summaryRows: [
        {
          label: "✅ Sitters vérifiés",
          value:
            "Chaque sitter est sélectionné et vérifié manuellement par notre équipe",
        },
        {
          label: "📅 Réservation simple",
          value: "Choisissez vos dates, confirmez en 2 clics — aucune complication",
        },
        {
          label: "💬 Support réactif",
          value: "Notre équipe répond sous 24 h — Lausanne & Riviera vaudoise",
        },
      ],
      ctaLabel: "Trouver mon sitter →",
      ctaUrl: `${baseUrl}/search`,
      footerText:
        "Vous recevez cet email car vous venez de créer un compte DogShift. " +
        "DogShift • support@dogshift.ch",
      footerLinks: [
        { label: "dogshift.ch", url: baseUrl },
        { label: "support@dogshift.ch", url: "mailto:support@dogshift.ch" },
      ],
    });

    const text =
      `${greeting}\n\n` +
      `Bienvenue sur DogShift — la plateforme de dog-sitting premium en Suisse romande.\n\n` +
      `✅ Sitters vérifiés manuellement par notre équipe\n` +
      `📅 Réservation simple en 2 clics\n` +
      `💬 Support réactif — Lausanne & Riviera vaudoise\n\n` +
      `Trouver mon sitter : ${baseUrl}/search\n\n` +
      `— L'équipe DogShift\nsupport@dogshift.ch\n`;

    await sendEmail({
      to: email,
      subject: `Bienvenue sur DogShift${prenom ? `, ${prenom}` : ""} 🐶`,
      text,
      html,
    });

    // 2. Schedule follow-up J+3 (will be picked up by a future cron)
    const sendAfter = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await prisma.scheduledEmail.create({
      data: {
        userId,
        email,
        type: "owner_followup_j3",
        sendAfter,
        sent: false,
      },
    });

    // 3. Log
    await prisma.agentLog.create({
      data: {
        agentName: "onboarding-owner",
        actionType: "welcome_sent",
        summary: `Welcome email envoyé à ${email}`,
        details: { email, prenom: prenom ?? null, userId },
        targetId: userId,
        durationMs: Date.now() - start,
        status: "success",
      },
    });

    // 4. Telegram
    await sendTelegram(`🏠 Nouveau propriétaire inscrit : ${email}`);

    return NextResponse.json({ success: true, agent: "onboarding-owner" });
  } catch (error) {
    const durationMs = Date.now() - start;
    await prisma.agentLog
      .create({
        data: {
          agentName: "onboarding-owner",
          actionType: "error",
          summary: `Erreur: ${(error as Error).message}`,
          details: { error: String(error) },
          durationMs,
          status: "error",
        },
      })
      .catch(() => {});
    return NextResponse.json({ error: "Onboarding owner agent error" }, { status: 500 });
  }
}
