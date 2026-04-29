import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/agents/notification
 * Agent Notification : envoyer des notifications (email, SMS, in-app)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, type, userId, message, title, bookingId } = body;

    if (!action || !userId || !message) {
      return NextResponse.json({ error: "Missing required fields: action, userId, message" }, { status: 400 });
    }

    const start = Date.now();
    let result;

    switch (action) {
      case "notify":
      case "send_notification": {
        // Notification in-app
        const notification = await prisma.notification.create({
          data: {
            userId,
            type: type || "newMessages",
            title: title || message.slice(0, 100),
            body: message,
            entityId: bookingId || undefined,
            idempotencyKey: `agent_${Date.now()}_${userId}`,
          },
        });

        result = { success: true, notificationId: notification.id, channel: "in-app" };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Logger
    const durationMs = Date.now() - start;
    await prisma.agentLog.create({
      data: {
        agentName: "notification_agent",
        actionType: `notification_${action}`,
        summary: `Notification envoyée à ${userId}: ${message.slice(0, 80)}`,
        details: { action, type, userId, bookingId },
        targetId: userId,
        durationMs,
        status: "success",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[agents/notification] Error:", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}