import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkAgentActive } from "@/lib/agent-guard";
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
  const guard = await checkAgentActive("onboarding-owner");
  if (guard) return guard;

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
      ? `Bienvenue sur DogShift, ${prenom}`
      : "Bienvenue sur DogShift";

    const logoUrl = `${baseUrl}/dogshift-logo.png`;
    const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
    const D  = `<td valign="top" style="padding:8px 10px 0 0;width:10px;"><div style="width:10px;height:10px;border-radius:50%;background:#818cf8;"></div></td>`;
    const DG = `<td valign="top" style="padding:8px 10px 0 0;width:10px;"><div style="width:10px;height:10px;border-radius:50%;background:#4ade80;"></div></td>`;

    const welcomeTipsHtml = `
      <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
        <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Bien démarrer sur DogShift</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>${D}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Parcours les sitters</strong> — filtre par service, disponibilité et zone géographique.</td></tr>
          <tr>${D}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Lis les profils</strong> — photos, avis et descriptions te donnent une idée claire de chaque sitter.</td></tr>
          <tr>${D}<td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Réserve en quelques clics</strong> — choisis tes dates, confirme et laisse DogShift gérer le reste.</td></tr>
        </table>
      </div>
      <div style="margin-top:14px;padding:14px 18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>${DG}<td style="font-family:${FF};font-size:13px;line-height:20px;color:#166534;"><strong>Chaque sitter est vérifié manuellement</strong> — identité, domicile et entretien individuel avant publication.</td></tr>
        </table>
      </div>`;

    // 1. Send welcome email
    const { html } = renderEmailLayout({
      logoUrl,
      title: greeting,
      subtitle: "Trouvez le dog-sitter idéal pour votre compagnon en toute sérénité.",
      summaryTitle: "Pourquoi choisir DogShift ?",
      summaryRows: [
        { label: "Sitters vérifiés", value: "Chaque sitter est sélectionné et vérifié manuellement par notre équipe" },
        { label: "Réservation simple", value: "Choisissez vos dates, confirmez en 2 clics — aucune complication" },
        { label: "Support réactif", value: "Notre équipe répond sous 24 h — Lausanne & Riviera vaudoise" },
      ],
      extraHtml: welcomeTipsHtml,
      ctaLabel: "Trouver mon sitter →",
      ctaUrl: `${baseUrl}/search`,
      secondaryLinkLabel: "Comment ça marche",
      secondaryLinkUrl: `${baseUrl}/how-it-works`,
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
      `Sitters vérifiés manuellement par notre équipe\n` +
      `Réservation simple en 2 clics\n` +
      `Support réactif — Lausanne & Riviera vaudoise\n\n` +
      `Trouver mon sitter : ${baseUrl}/search\n\n` +
      `— L'équipe DogShift\nsupport@dogshift.ch\n`;

    await sendEmail({
      to: email,
      subject: `Bienvenue sur DogShift${prenom ? `, ${prenom}` : ""}`,
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
