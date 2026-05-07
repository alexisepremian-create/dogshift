import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const userId = access.userId;

    const body = (await req.json().catch(() => null)) as null | {
      sitterId?: string;
      decision?: "approved" | "rejected";
      notes?: string;
    };

    const sitterId = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";
    const decision = body?.decision;
    const notesRaw = typeof body?.notes === "string" ? body.notes : "";
    const notes = notesRaw.trim() ? notesRaw.trim().slice(0, 2000) : null;

    if (!sitterId || (decision !== "approved" && decision !== "rejected")) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const db = prisma as unknown as {
      sitterProfile: {
        findFirst: (args: unknown) => Promise<{
          id: string;
          sitterId: string;
          displayName?: string | null;
          verificationStatus?: string | null;
          user?: { email?: string | null; name?: string | null } | null;
        } | null>;
        update: (args: unknown) => Promise<unknown>;
      };
      verificationAccessLog: { create: (args: unknown) => Promise<unknown> };
    };

    const sitterProfile = await db.sitterProfile.findFirst({
      where: { sitterId },
      select: { id: true, sitterId: true, displayName: true, verificationStatus: true, user: { select: { email: true, name: true } } },
    });

    if (!sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const prevStatus = typeof sitterProfile.verificationStatus === "string" ? sitterProfile.verificationStatus : "not_verified";
    if (prevStatus !== "pending") {
      return NextResponse.json({ ok: false, error: "NOT_PENDING" }, { status: 409 });
    }

    await db.sitterProfile.update({
      where: { id: sitterProfile.id },
      data: {
        verificationStatus: decision,
        verificationReviewedAt: new Date(),
        verificationNotes: notes,
      },
    });

    await db.verificationAccessLog.create({
      data: {
        sitterProfileId: sitterProfile.id,
        sitterId: sitterProfile.sitterId,
        action: decision === "approved" ? "review_approved" : "review_rejected",
        fileKey: null,
        adminClerkUserId: userId ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    });

    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
    const sitterEmail = sitterProfile.user?.email ?? "";
    const sitterName = (sitterProfile.displayName ?? sitterProfile.user?.name ?? "").trim();
    const firstName = sitterName.split(" ")[0] || "Bonjour";

    // Result email to sitter
    if (sitterEmail) {
      const isApproved = decision === "approved";
      const subject = isApproved
        ? "Votre identité a été vérifiée — Bienvenue sur DogShift ✓"
        : "Vérification d'identité — Action requise";
      const bodyHtml = isApproved
        ? `
          <p style="margin:0 0 12px 0;">Bonne nouvelle, ${firstName} !</p>
          <p style="margin:0 0 12px 0;">
            Votre identité a été <strong style="color:#059669;">vérifiée avec succès</strong>.
            Votre profil est maintenant éligible à la publication sur DogShift.
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px;">
            Pensez à compléter votre profil et à activer la publication depuis votre tableau de bord.
          </p>
        `
        : `
          <p style="margin:0 0 12px 0;">Bonjour ${firstName},</p>
          <p style="margin:0 0 16px 0;">
            Malheureusement, nous n'avons pas pu valider votre demande de vérification d'identité.
            ${notes ? `<br/><strong>Motif :</strong> ${notes}` : ""}
          </p>
          <p style="margin:0 0 12px 0;">
            Vous pouvez soumettre de nouveaux documents depuis votre profil.
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px;">
            En cas de question : <a href="mailto:support@dogshift.ch" style="color:#6b7280;">support@dogshift.ch</a>
          </p>
        `;
      const { html } = renderEmailLayout({
        title: subject,
        extraHtml: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">${bodyHtml}</div>`,
        ctaLabel: "Voir mon profil",
        ctaUrl: `${APP_URL}/host/profile/edit`,
        footerText: "DogShift · Dog-sitting premium en Suisse · support@dogshift.ch",
      });
      await sendEmail({
        to: sitterEmail,
        subject,
        html,
        text: isApproved
          ? `Bonne nouvelle ${firstName} ! Votre identité a été vérifiée avec succès.`
          : `Bonjour ${firstName}, votre vérification n'a pas pu être validée. ${notes ?? ""}`,
      }).catch((e) => console.error("[admin][verifications][review] email failed", e));
    }

    // Telegram confirmation
    const emoji = decision === "approved" ? "✅" : "❌";
    await sendTelegramMessage(
      `[DogShift] ${emoji} Vérification identité — décision manuelle\n\nSitter : ${sitterName || sitterId}\nDécision : ${decision === "approved" ? "Approuvée" : "Refusée"}${notes ? `\nNote : ${notes}` : ""}\n\nEmail envoyé à : ${sitterEmail || "—"}`,
      { bot: "verifications" }
    ).catch((e) => console.error("[admin][verifications][review] telegram failed", e));

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api][admin][verifications][review] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
