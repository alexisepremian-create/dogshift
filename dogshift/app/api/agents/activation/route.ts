import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ====================================================================
// AGENT ACTIVATION (nouveau sitter inscrit)
// Remplace le workflow n8n "Activation Sitter"
// Reçoit nouveau sitter → notifie Telegram
// ====================================================================

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "977094430";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

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
    const { name, email, city, services } = body;

    if (!email) {
      return NextResponse.json({ error: "email requis" }, { status: 400 });
    }

    // Logger
    await prisma.agentLog.create({
      data: {
        agentName: "activation",
        actionType: "sitter_registered",
        summary: `Nouveau sitter inscrit : ${name || ""} <${email}>`,
        details: { name, email, city, services },
        targetId: null,
        durationMs: Date.now() - start,
        status: "success",
      },
    });

    // Notification Telegram
    const servicesStr = Array.isArray(services) ? services.join(", ") : (services || "—");
    await sendTelegram(
      `🎉 *Nouveau sitter inscrit !*\n👤 ${name || "Inconnu"}\n📧 ${email}\n📍 ${city || "—"}\n🐾 Services : ${servicesStr}`
    );

    return NextResponse.json({
      success: true,
      agent: "activation",
      message: `Nouveau sitter ${name || ""} notifié`,
    });
  } catch (error) {
    await prisma.agentLog.create({
      data: {
        agentName: "activation",
        actionType: "error",
        summary: `Erreur: ${(error as Error).message}`,
        details: { error: String(error) },
        durationMs: Date.now() - start,
        status: "error",
      },
    });
    return NextResponse.json({ error: "Activation agent error", details: (error as Error).message }, { status: 500 });
  }
}