import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { verifyCalcomSignature } from "@/lib/calcom/verifyCalcomSignature";

// ====================================================================
// AGENT CALENDRIER (Notifications Cal.com)
// Remplace le workflow n8n "DogShift — Notifications Cal.com"
// Reçoit les webhooks Cal.com → notifie Telegram
//
// SECURITY: every request must carry a valid HMAC-SHA256 signature from
// Cal.com in the `X-Cal-Signature-256` header. The signing secret lives in
// `CALCOM_WEBHOOK_SECRET` and must match the "Secret" field on the Cal.com
// webhook. Requests without (or with a wrong) signature are rejected with
// 401 and never reach Telegram / Prisma.
// ====================================================================

export const runtime = "nodejs";

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
    // Read the raw body once — both signature verification and JSON parsing
    // need it, and req.text() can only be called a single time per request.
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-cal-signature-256");
    const verification = verifyCalcomSignature({
      rawBody,
      signatureHeader,
      secret: process.env.CALCOM_WEBHOOK_SECRET,
    });

    if (!verification.ok) {
      // Misconfiguration (no secret on the server) is a 503 so it's visible
      // in monitoring without leaking that the endpoint exists; a bad/missing
      // signature is a 401 so attackers can't tell whether their guess was
      // close. Either way we never touch Prisma or Telegram.
      const status = verification.reason === "MISSING_SECRET" ? 503 : 401;
      console.warn("[api][agents/calendrier] webhook rejected", {
        reason: verification.reason,
        hasSignatureHeader: Boolean(signatureHeader),
      });
      return NextResponse.json({ error: "Unauthorized" }, { status });
    }

    let body: { triggerEvent?: string; payload?: Record<string, unknown> };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const triggerEvent = body.triggerEvent;
    const payload = (body.payload ?? {}) as Record<string, unknown> & {
      attendees?: Array<Record<string, unknown>>;
      responses?: Record<string, { value?: unknown }>;
      startTime?: string;
      length?: number;
      videoCallData?: { url?: string };
      additionalNotes?: string;
      uid?: string;
      cancellationReason?: string;
    };
    const attendee = (payload.attendees?.[0] ?? {}) as { name?: string; email?: string };
    const responses = (payload.responses ?? {}) as Record<string, { value?: unknown }>;

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