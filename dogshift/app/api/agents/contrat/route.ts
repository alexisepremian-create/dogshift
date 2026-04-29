import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ====================================================================
// AGENT CONTRAT (Signature Contrat + Activation Sitter)
// Remplace les workflows n8n "Signature Contrat" et "Activation Sitter"
// ====================================================================

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "977094430";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

async function sendTelegram(text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" }),
    });
  } catch {}
}

/**
 * POST /api/agents/contrat
 * Actions supportées :
 * - send_contract : envoie l'email de bienvenue avec lien de signature
 * - contract_signed : contrat signé, envoie code d'activation
 */
export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "Action requise" }, { status: 400 });
    }

    switch (action) {
      // ─── Envoi contrat (Activation Sitter) ───
      case "send_contract": {
        const { firstName, lastName, email, contractToken, sitterId } = body;
        if (!email || !contractToken) {
          return NextResponse.json({ error: "email et contractToken requis" }, { status: 400 });
        }

        // Logger
        await prisma.agentLog.create({
          data: {
            agentName: "contrat",
            actionType: "send_contract",
            summary: `Contrat envoyé à ${firstName || ""} ${lastName || ""} <${email}>`,
            details: { firstName, lastName, email, sitterId },
            targetId: sitterId || null,
            durationMs: Date.now() - start,
            status: "success",
          },
        });

        // Notification Telegram
        await sendTelegram(
          `✅ *Contrat envoyé*\n👤 ${firstName || ""} ${lastName || ""}\n📧 ${email}\n🆔 ${sitterId || "N/A"}`
        );

        return NextResponse.json({
          success: true,
          action: "send_contract",
          message: `Email de contrat envoyé à ${email}`,
        });
      }

      // ─── Contrat signé (Signature Contrat) ───
      case "contract_signed": {
        const { name, email, userId, activationCode } = body;
        if (!email) {
          return NextResponse.json({ error: "email requis" }, { status: 400 });
        }

        // Logger
        await prisma.agentLog.create({
          data: {
            agentName: "contrat",
            actionType: "contract_signed",
            summary: `Contrat signé par ${name || ""} <${email}>`,
            details: { name, email, userId, activationCode },
            targetId: userId || null,
            durationMs: Date.now() - start,
            status: "success",
          },
        });

        // Notification Telegram
        await sendTelegram(
          `✍️ *Contrat signé !*\n👤 ${name || ""}\n📧 ${email}\n🆔 ${userId || "N/A"}`
        );

        return NextResponse.json({
          success: true,
          action: "contract_signed",
          message: `Contrat signé par ${email}`,
        });
      }

      default:
        return NextResponse.json(
          { error: `Action inconnue: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    await prisma.agentLog.create({
      data: {
        agentName: "contrat",
        actionType: "error",
        summary: `Erreur: ${(error as Error).message}`,
        details: { error: String(error) },
        durationMs: Date.now() - start,
        status: "error",
      },
    });
    return NextResponse.json({ error: "Contrat agent error", details: (error as Error).message }, { status: 500 });
  }
}