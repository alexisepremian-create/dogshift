import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

// ====================================================================
// AGENT ACTIVATION (nouveau sitter inscrit)
// Remplace le workflow n8n "Activation Sitter"
// Reçoit nouveau sitter → notifie Telegram
// ====================================================================

async function sendTelegram(text: string) {
  await sendTelegramMessage(text, { bot: "candidatures" }).catch(() => {});
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