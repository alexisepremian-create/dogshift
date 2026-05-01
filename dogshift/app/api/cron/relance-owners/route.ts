import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function readCronSecretFromRequest(req: NextRequest) {
  const header = (req.headers.get("x-cron-secret") || "").trim();
  if (header) return header;

  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }

  return "";
}

export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "MISSING_CRON_SECRET" }, { status: 500 });
  }

  const provided = readCronSecretFromRequest(req);
  if (!provided || provided !== secret) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const start = Date.now();
  const now = new Date();
  // "between 3 and 7 days ago" → lastMessageAt ∈ [now-7d, now-3d]
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "https://dogshift.ch"
  ).replace(/\/$/, "");

  let processed = 0;

  try {
    // Get userIds that already received this relance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alreadyRelanced = (await (prisma as any).scheduledEmail.findMany({
      where: { type: "relance_owner_j3", sent: true },
      select: { userId: true },
    })) as Array<{ userId: string }>;
    const excludedUserIds = alreadyRelanced.map((r) => r.userId);

    // Find eligible owners:
    // - role OWNER
    // - at least one conversation with lastMessageAt in [now-7d, now-3d]
    // - no PAID or CONFIRMED booking
    // - not already relanced
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const owners = await (prisma as any).user.findMany({
      where: {
        role: "OWNER",
        id: { notIn: excludedUserIds },
        ownerConversations: {
          some: {
            lastMessageAt: { gte: sevenDaysAgo, lte: threeDaysAgo },
          },
        },
        bookings: {
          none: {
            status: { in: ["PAID", "CONFIRMED"] },
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        ownerConversations: {
          where: {
            lastMessageAt: { gte: sevenDaysAgo, lte: threeDaysAgo },
          },
          orderBy: { lastMessageAt: "desc" },
          take: 1,
          select: {
            lastMessageAt: true,
            sitter: {
              select: {
                name: true,
                sitterProfile: {
                  select: { displayName: true, city: true },
                },
              },
            },
          },
        },
      },
      take: 50,
    });

    for (const owner of owners ?? []) {
      const conv = owner.ownerConversations?.[0];
      if (!conv) continue;

      const sitterPrenom =
        (typeof conv.sitter?.sitterProfile?.displayName === "string" &&
        conv.sitter.sitterProfile.displayName.trim()
          ? conv.sitter.sitterProfile.displayName.trim()
          : null) ??
        (typeof conv.sitter?.name === "string" && conv.sitter.name.trim()
          ? conv.sitter.name.trim().split(" ")[0]
          : null);

      const sitterVille =
        typeof conv.sitter?.sitterProfile?.city === "string" &&
        conv.sitter.sitterProfile.city.trim()
          ? conv.sitter.sitterProfile.city.trim()
          : null;

      const daysSinceLastMessage = conv.lastMessageAt
        ? Math.floor(
            (now.getTime() - new Date(conv.lastMessageAt).getTime()) / (1000 * 60 * 60 * 24)
          )
        : 3;

      // Extract first name from owner's full name
      const prenom =
        typeof owner.name === "string" && owner.name.trim()
          ? owner.name.trim().split(" ")[0]
          : undefined;

      try {
        await fetch(`${appUrl}/api/agents/relance-owner`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: owner.id,
            email: owner.email,
            prenom,
            sitterPrenom: sitterPrenom ?? undefined,
            sitterVille: sitterVille ?? undefined,
            daysSinceLastMessage,
          }),
        });
        processed += 1;
      } catch (err) {
        console.error("[cron][relance-owners] agent fetch failed", { userId: owner.id, err });
      }

      // 300ms between calls to respect Resend rate limits
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    await prisma.agentLog.create({
      data: {
        agentName: "cron-relance-owners",
        actionType: "cron_run",
        summary: `${processed} owners relancés`,
        details: { processed, excludedCount: excludedUserIds.length },
        durationMs: Date.now() - start,
        status: "success",
      },
    });

    return NextResponse.json({ success: true, processed });
  } catch (error) {
    const durationMs = Date.now() - start;
    await prisma.agentLog
      .create({
        data: {
          agentName: "cron-relance-owners",
          actionType: "error",
          summary: `Erreur: ${(error as Error).message}`,
          details: { error: String(error) },
          durationMs,
          status: "error",
        },
      })
      .catch(() => {});
    console.error("[api][cron][relance-owners] error", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
