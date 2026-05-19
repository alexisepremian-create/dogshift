import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";

// ====================================================================
// AGENT RELANCE OWNER
// Sends a Claude-generated personalized French email to an owner who
// has chatted with a sitter but never completed a booking.
// ====================================================================

export const runtime = "nodejs";

import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { escapeHtml, formatDateFR, tgHeader, tgMessage, tgSection } from "@/lib/telegram/format";

/**
 * Send the relance recap to the `relances` bot. Returns `true` on
 * apparent success, `false` if Telegram refused or the env vars are
 * missing — caller persists this to AgentLog so we can detect silent
 * bot drops (the same gotcha as bug-regression-check, see CLAUDE.md
 * "Cron jobs" section).
 */
async function sendTelegram(text: string): Promise<boolean> {
  try {
    return await sendTelegramMessage(text, { bot: "relances", parseMode: "HTML" });
  } catch {
    return false;
  }
}

function formatRelanceMessage(args: {
  email: string;
  prenom?: string | null;
  sitterPrenom?: string | null;
  sitterVille?: string | null;
  daysSinceLastMessage?: number | null;
}): string {
  const sitterLabel = args.sitterVille
    ? `${args.sitterPrenom ?? "un sitter"} (${args.sitterVille})`
    : args.sitterPrenom ?? "un sitter";

  return tgMessage([
    tgHeader("💌", "Relance owner", new Date()),
    [
      tgSection("👤", "Propriétaire"),
      `${args.prenom ? escapeHtml(args.prenom) + " · " : ""}<code>${escapeHtml(args.email)}</code>`,
    ],
    [
      tgSection("🐕", "Contexte"),
      `Sitter contacté : ${escapeHtml(sitterLabel)}`,
      args.daysSinceLastMessage != null
        ? `Dernier message il y a ${args.daysSinceLastMessage} jour${args.daysSinceLastMessage > 1 ? "s" : ""}`
        : `Délai depuis le dernier message non disponible`,
    ],
    `<i>Généré automatiquement · ${formatDateFR()}</i>`,
  ]);
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

    // 1. Generate personalized body paragraphs via Claude
    const { text: rawText } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: `Tu es chargé de rédiger le corps d'un email court, chaleureux et émotionnel au nom de DogShift, plateforme premium de dog-sitting en Suisse romande.
Ton rôle : inciter un propriétaire de chien à finaliser sa réservation auprès d'un sitter avec qui il a échangé.
Ton ton est humain, bienveillant, pas commercial — tu parles du bien-être du chien et de la confiance que DogShift garantit.
Tu réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans balises \`\`\`json — juste le JSON brut.
Le JSON doit avoir exactement ces deux champs : { "subject": string, "bodyHtml": string }
Le bodyHtml doit contenir UNIQUEMENT les paragraphes du corps (balises <p> et <strong> uniquement).
Ne pas inclure : doctype, html, head, body, table, bouton CTA, header, footer, logo — notre système les ajoute automatiquement.
Aucun emoji. Style sobre, professionnel et chaleureux.`,
      prompt: `Rédige le corps d'un email de relance pour un propriétaire de chien qui a échangé avec un sitter sur DogShift mais n'a pas encore réservé.

Informations disponibles :
- Prénom du propriétaire : ${prenom ?? "non renseigné"}
- Prénom du sitter : ${sitterPrenom ?? "non renseigné"}
- Ville du sitter : ${sitterVille ?? "non renseignée"}
- Jours depuis le dernier message : ${daysSinceLastMessage ?? "quelques"}

Le corps doit :
- Commencer par "Bonjour ${prenom ?? ""}," puis une accroche chaleureuse personnalisée
- Rappeler subtilement la conversation avec le sitter (ton non-commercial, empathique)
- Mettre en avant le bien-être du chien et la tranquillité d'esprit que DogShift offre
- Mentionner que chaque sitter est vérifié manuellement (identité, domicile, entretien)
- Rester court (3-4 paragraphes max), sans insistance
- Aucun emoji, aucun bouton (le CTA est ajouté par notre système)

Réponds UNIQUEMENT avec le JSON brut : { "subject": "...", "bodyHtml": "<p>...</p><p>...</p>" }`,
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

    // 2. Wrap Claude's body in the standard DogShift layout
    const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
    const personalBodyHtml = `
      <div style="font-family:${FF};font-size:14px;line-height:22px;color:#374151;">
        ${emailContent.bodyHtml}
      </div>`;

    const logoUrl = `${baseUrl}/dogshift-logo.png`;
    const { html } = renderEmailLayout({
      logoUrl,
      title: emailContent.subject,
      extraHtml: personalBodyHtml,
      ctaLabel: "Finaliser ma réservation →",
      ctaUrl: `${baseUrl}/sitters`,
      secondaryLinkLabel: "Voir les sitters disponibles",
      secondaryLinkUrl: `${baseUrl}/sitters`,
      footerText: "Vous recevez cet email car vous avez échangé avec un sitter sur DogShift sans finaliser votre réservation.",
      footerLinks: [
        { label: "dogshift.ch", url: baseUrl },
        { label: "support@dogshift.ch", url: "mailto:support@dogshift.ch" },
      ],
    });

    const fallbackText =
      `${prenom ? `Bonjour ${prenom},\n\n` : ""}` +
      `Vous avez échangé avec ${sitterPrenom ?? "un sitter"}${sitterVille ? ` à ${sitterVille}` : ""} sur DogShift ` +
      `il y a ${daysSinceLastMessage ?? "quelques"} jours. ` +
      `Finalisez votre réservation : ${baseUrl}/sitters\n\n— L'équipe DogShift`;

    // 3. Send email via Resend
    await sendEmail({
      to: email,
      subject: emailContent.subject,
      html,
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

    // 4. Telegram — sent BEFORE AgentLog so the boolean ends up in
    // the audit details. `sendTelegram` returns false on missing env
    // vars (TELEGRAM_BOT_TOKEN_RELANCES / TELEGRAM_CHAT_ID_RELANCES not
    // set) or any non-2xx response — that's how we detect a silently
    // misconfigured bot. Same audit trail as bug-regression-check.
    const telegramSent = await sendTelegram(
      formatRelanceMessage({ email, prenom, sitterPrenom, sitterVille, daysSinceLastMessage }),
    );

    // 5. AgentLog (with telegramSent flag for audit + ops debugging)
    await prisma.agentLog.create({
      data: {
        agentName: "relance-owner",
        actionType: "relance_sent",
        summary: `Relance envoyée à ${email} — sitter: ${sitterPrenom ?? "?"} (${sitterVille ?? "?"}). Telegram ${telegramSent ? "sent" : "DROPPED"}.`,
        details: {
          userId,
          email,
          prenom: prenom ?? null,
          sitterPrenom: sitterPrenom ?? null,
          sitterVille: sitterVille ?? null,
          daysSinceLastMessage: daysSinceLastMessage ?? null,
          subject: emailContent.subject,
          telegramSent,
        },
        targetId: userId,
        durationMs: Date.now() - start,
        status: "success",
      },
    });

    return NextResponse.json({ success: true, agent: "relance-owner", telegramSent });
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
