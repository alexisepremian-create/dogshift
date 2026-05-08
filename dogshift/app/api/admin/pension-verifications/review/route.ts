/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { sendPensionResultEmail } from "@/lib/pensionVerificationAgent";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const body = (await req.json().catch(() => null)) as null | {
      sitterId?: string;
      decision?: "approved" | "rejected";
      notes?: string;
      pensionAcceptedSizes?: string[];
    };

    const sitterId = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";
    const decision = body?.decision;
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    const pensionAcceptedSizes = Array.isArray(body?.pensionAcceptedSizes)
      ? body.pensionAcceptedSizes.filter((s: unknown) => s === "small" || s === "medium" || s === "large")
      : null;

    if (!sitterId || (decision !== "approved" && decision !== "rejected")) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const db = prisma as any;
    const profile = await db.sitterProfile.findFirst({
      where: { sitterId },
      select: {
        id: true,
        displayName: true,
        pensionAiScore: true,
        user: { select: { email: true, name: true } },
      },
    });
    if (!profile) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    await db.sitterProfile.update({
      where: { id: profile.id },
      data: {
        pensionVerifStatus: decision,
        pensionPhotoReviewedAt: new Date(),
        pensionAdminNotes: notes,
        ...(decision === "approved" && pensionAcceptedSizes !== null
          ? { pensionAcceptedSizes }
          : {}),
      },
    });

    const sitterEmail = profile.user?.email ?? "";
    const sitterName = (profile.displayName ?? profile.user?.name ?? "").trim();

    // Send result email to sitter
    if (sitterEmail) {
      await sendPensionResultEmail({
        sitterEmail,
        sitterName,
        finalStatus: decision,
        score: typeof profile.pensionAiScore === "number" ? profile.pensionAiScore : 0,
      }).catch((e) => console.error("[admin][pension-review] email failed", e));
    }

    // Telegram confirmation to admin
    const emoji = decision === "approved" ? "✅" : "❌";
    await sendTelegramMessage(
      `[DogShift] ${emoji} Vérification Pension — décision manuelle\n\nSitter : ${sitterName || sitterId}\nDécision : ${decision === "approved" ? "Approuvé" : "Refusé"}${notes ? `\nNote : ${notes}` : ""}\n\nEmail envoyé à : ${sitterEmail || "—"}`,
      { bot: "verifications" }
    ).catch((e) => console.error("[admin][pension-review] telegram failed", e));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api][admin][pension-verifications][review]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
