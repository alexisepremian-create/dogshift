import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";

// ====================================================================
// AGENT RELANCE OWNER
// Sends a Claude-generated personalized French email to an owner who
// has chatted with a sitter but never completed a booking.
// ====================================================================

export const runtime = "nodejs";

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
    const { userId, email, prenom, sitterPrenom, sitterVille, daysSinceLastMessage } = body as {
      userId?: string;
      email?: string;
      prenom?: string;
      sitterPrenom?: string;
      sitterVille?: string;
      daysSinceLastMessage?: number;
    };

    if (!userId || !email) {
      return NextResponse.json({ error: "userId et email requis" }, { status: 400 });
    }

    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "https://dogshift.ch"
    ).replace(/\/$/, "");

    // 1. Generate personalized email copy via Claude
    const { text: rawText } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: `Tu es chargé de rédiger un email court, chaleureux et émotionnel au nom de DogShift, plateforme premium de dog-sitting en Suisse romande.
Ton rôle : inciter un propriétaire de chien à finaliser sa réservation auprès d'un sitter avec qui il a échangé.
Ton ton est humain, bienveillant, pas commercial — tu parles du bien-être du chien et de la confiance que DogShift garantit.
Tu réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans balises \`\`\`json — juste le JSON brut.
Le JSON doit avoir exactement ces deux champs : { "subject": string, "bodyHtml": string }
Le bodyHtml doit être du HTML propre (balises <p>, <strong>, <a>) incluant un bouton CTA vers ${baseUrl}/sitters.`,
      prompt: `Rédige un email de relance pour un propriétaire de chien qui a échangé avec un sitter sur DogShift mais n'a pas encore réservé.

Informations disponibles :
- Prénom du propriétaire : ${prenom ?? "non renseigné"}
- Prénom du sitter : ${sitterPrenom ?? "non renseigné"}
- Ville du sitter : ${sitterVille ?? "non renseignée"}
- Jours depuis le dernier message : ${daysSinceLastMessage ?? "quelques"}

L'email doit :
- Commencer par une accroche chaleureuse personnalisée si le prénom est disponible
- Rappeler subtilement la conversation avec le sitter
- Mettre en avant le bien-être du chien et la tranquillité d'esprit que DogShift offre
- Inclure un bouton CTA "Finaliser ma réservation →" pointant vers ${baseUrl}/sitters
- Rester court (3-4 paragraphes max), chaleureux, et ne pas être insistant

Réponds UNIQUEMENT avec le JSON brut : { "subject": "...", "bodyHtml": "..." }`,
    });

    let emailContent: { subject: string; bodyHtml: string };
    try {
      emailContent = JSON.parse(rawText.trim());
    } catch {
      throw new Error(`Claude output parse error: ${rawText.slice(0, 200)}`);
    }

    if (!emailContent.subject || !emailContent.bodyHtml) {
      throw new Error("Claude output missing subject or bodyHtml");
    }

    // 2. Send email via Resend
    const fallbackText =
      `${prenom ? `Bonjour ${prenom},\n\n` : ""}` +
      `Vous avez échangé avec ${sitterPrenom ?? "un sitter"}${sitterVille ? ` à ${sitterVille}` : ""} sur DogShift ` +
      `il y a ${daysSinceLastMessage ?? "quelques"} jours. ` +
      `Finalisez votre réservation : ${baseUrl}/sitters\n\n— L'équipe DogShift`;

    await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.bodyHtml,
      text: fallbackText,
    });

    // 3. Log ScheduledEmail (cron already deduped — just stamp as sent)
    await prisma.scheduledEmail.create({
      data: {
        userId,
        email,
        type: "relance_owner_j3",
        sendAfter: new Date(),
        sent: true,
        sentAt: new Date(),
      },
    });

    // 4. AgentLog
    await prisma.agentLog.create({
      data: {
        agentName: "relance-owner",
        actionType: "relance_sent",
        summary: `Relance envoyée à ${email} — sitter: ${sitterPrenom ?? "?"} (${sitterVille ?? "?"})`,
        details: {
          userId,
          email,
          prenom: prenom ?? null,
          sitterPrenom: sitterPrenom ?? null,
          sitterVille: sitterVille ?? null,
          daysSinceLastMessage: daysSinceLastMessage ?? null,
          subject: emailContent.subject,
        },
        targetId: userId,
        durationMs: Date.now() - start,
        status: "success",
      },
    });

    // 5. Telegram
    await sendTelegram(
      `💌 Relance envoyée à ${email} — sitter: ${sitterPrenom ?? "?"} (${sitterVille ?? "?"})`
    );

    return NextResponse.json({ success: true, agent: "relance-owner" });
  } catch (error) {
    const durationMs = Date.now() - start;
    await prisma.agentLog
      .create({
        data: {
          agentName: "relance-owner",
          actionType: "error",
          summary: `Erreur: ${(error as Error).message}`,
          details: { error: String(error) },
          durationMs,
          status: "error",
        },
      })
      .catch(() => {});
    return NextResponse.json({ error: "Relance owner agent error" }, { status: 500 });
  }
}
