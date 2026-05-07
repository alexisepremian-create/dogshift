import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

// ====================================================================
// AGENT CALENDRIER (Notifications Cal.com)
// Remplace le workflow n8n "DogShift — Notifications Cal.com"
// Reçoit les webhooks Cal.com → notifie Telegram
// ====================================================================

async function sendTelegram(text: string) {
  await sendTelegramMessage(text, { bot: "candidatures", parseMode: "Markdown" }).catch(() => {});
}

// Formate une date ISO en français
function formatDate(iso: string | undefined | null): string {
  if (!iso) return "Date inconnue";
  try {
    return new Intl.DateTimeFormat("fr-CH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Zurich",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await req.json();
    const triggerEvent = body.triggerEvent;
    const payload = body.payload || {};
    const attendee = payload.attendees?.[0] || {};
    const responses = payload.responses || {};

    if (!triggerEvent) {
      return NextResponse.json({ error: "triggerEvent requis" }, { status: 400 });
    }

    let actionType = "";
    let telegramMessage = "";

    switch (triggerEvent) {
      case "BOOKING_CREATED":
        actionType = "booking_created";
        telegramMessage = [
          `🎉 *Nouvel entretien booké !*`,
          ``,
          `👤 *${attendee.name || "Inconnu"}*`,
          `📧 ${attendee.email || "—"}`,
          `📞 ${responses.attendeePhoneNumber?.value || "Non renseigné"}`,
          ``,
          `📅 ${formatDate(payload.startTime)}`,
          `⏱️ ${payload.length || "—"} min`,
          `🎥 ${payload.videoCallData?.url || "Aucun lien"}`,
          ``,
          `📝 ${payload.additionalNotes || "Aucune note"}`,
          `🆔 \`${payload.uid || "—"}\``,
        ].join("\n");
        break;

      case "BOOKING_CANCELLED":
        actionType = "booking_cancelled";
        telegramMessage = [
          `❌ *Entretien annulé*`,
          ``,
          `👤 *${attendee.name || "Inconnu"}*`,
          `📧 ${attendee.email || "—"}`,
          `📞 ${responses.attendeePhoneNumber?.value || "Non renseigné"}`,
          ``,
          `📅 Était prévu le ${formatDate(payload.startTime)}`,
          `💬 Raison : ${payload.cancellationReason || "Non précisée"}`,
          `🆔 \`${payload.uid || "—"}\``,
        ].join("\n");
        break;

      case "BOOKING_RESCHEDULED":
        actionType = "booking_rescheduled";
        telegramMessage = [
          `🔄 *Entretien replanifié*`,
          ``,
          `👤 *${attendee.name || "Inconnu"}*`,
          `📧 ${attendee.email || "—"}`,
          `📞 ${responses.attendeePhoneNumber?.value || "Non renseigné"}`,
          ``,
          `📅 *Nouvelle date :* ${formatDate(payload.startTime)}`,
          `⏱️ ${payload.length || "—"} min`,
          `🎥 ${payload.videoCallData?.url || "Aucun lien"}`,
          `💬 Raison : ${responses.rescheduleReason?.value || "Non précisée"}`,
          `🆔 \`${payload.uid || "—"}\``,
        ].join("\n");
        break;

      default:
        return NextResponse.json({ error: `Événement inconnu: ${triggerEvent}` }, { status: 400 });
    }

    // Logger
    await prisma.agentLog.create({
      data: {
        agentName: "calendrier",
        actionType,
        summary: `Cal.com: ${triggerEvent} - ${attendee.name || "inconnu"}`,
        details: { triggerEvent, attendee: attendee.email, uid: payload.uid },
        targetId: payload.uid || null,
        durationMs: Date.now() - start,
        status: "success",
      },
    });

    // Notifier Telegram
    await sendTelegram(telegramMessage);

    return NextResponse.json({
      success: true,
      agent: "calendrier",
      action: actionType,
      notified: true,
    });
  } catch (error) {
    await prisma.agentLog.create({
      data: {
        agentName: "calendrier",
        actionType: "error",
        summary: `Erreur: ${(error as Error).message}`,
        details: { error: String(error) },
        durationMs: Date.now() - start,
        status: "error",
      },
    });
    return NextResponse.json({ error: "Calendrier agent error", details: (error as Error).message }, { status: 500 });
  }
}