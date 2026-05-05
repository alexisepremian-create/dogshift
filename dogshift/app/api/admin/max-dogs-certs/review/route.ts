/* eslint-disable @typescript-eslint/no-explicit-any */
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
    if (!access.isAdmin) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const body = (await req.json().catch(() => null)) as null | {
      sitterId?: string;
      decision?: "approved" | "rejected";
      notes?: string;
    };

    const sitterId = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";
    const decision = body?.decision;
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : null;

    if (!sitterId || (decision !== "approved" && decision !== "rejected")) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const db = prisma as any;
    const profile = await db.sitterProfile.findFirst({
      where: { sitterId },
      select: {
        id: true,
        displayName: true,
        acceptanceCriteria: true,
        user: { select: { email: true, name: true } },
      },
    });
    if (!profile) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    await db.sitterProfile.update({
      where: { id: profile.id },
      data: {
        maxDogsCertVerifStatus: decision,
        maxDogsCertReviewedAt: new Date(),
        maxDogsCertAdminNotes: notes,
      },
    });

    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
    const sitterEmail = profile.user?.email ?? "";
    const sitterName = (profile.displayName ?? profile.user?.name ?? "").trim();
    const firstName = sitterName.split(" ")[0] || "Bonjour";
    const maxDogs = profile.acceptanceCriteria && typeof profile.acceptanceCriteria === "object"
      ? (profile.acceptanceCriteria as Record<string, unknown>).maxDogs
      : null;

    // Email to sitter
    if (sitterEmail) {
      const isApproved = decision === "approved";
      const subject = isApproved
        ? "Votre document OPAn a été approuvé ✅"
        : "Votre document OPAn n'a pas été accepté";
      const bodyHtml = isApproved
        ? `
          <p style="margin:0 0 12px 0;">Bonjour ${firstName},</p>
          <p style="margin:0 0 12px 0;">
            Bonne nouvelle ! Votre document (attestation FSIFP ou autorisation cantonale) a été
            <strong>validé par notre équipe</strong>. Vous pouvez maintenant accepter plus de 5 chiens simultanément
            sur DogShift, conformément à la loi suisse (art. 101 OPAn).
          </p>
          ${notes ? `<p style="margin:0 0 12px 0;color:#374151;"><em>Note : ${notes}</em></p>` : ""}
          <p style="margin:0;color:#6b7280;font-size:13px;">Questions ? <a href="mailto:support@dogshift.ch" style="color:#6b7280;">support@dogshift.ch</a></p>
        `
        : `
          <p style="margin:0 0 12px 0;">Bonjour ${firstName},</p>
          <p style="margin:0 0 12px 0;">
            Nous avons examiné votre document mais celui-ci <strong>n'a pas pu être validé</strong>.
          </p>
          ${notes ? `<p style="margin:0 0 12px 0;color:#374151;"><em>Motif : ${notes}</em></p>` : ""}
          <p style="margin:0 0 12px 0;">
            Vous pouvez soumettre un nouveau document depuis votre tableau de bord.
            Si vous avez des questions, n'hésitez pas à nous contacter.
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px;">Questions ? <a href="mailto:support@dogshift.ch" style="color:#6b7280;">support@dogshift.ch</a></p>
        `;
      const { html } = renderEmailLayout({
        title: subject,
        extraHtml: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">${bodyHtml}</div>`,
        ctaLabel: "Voir mon profil",
        ctaUrl: `${APP_URL}/host/profile/edit`,
        footerText: "DogShift · Dog-sitting premium en Suisse · support@dogshift.ch",
      });
      await sendEmail({ to: sitterEmail, subject, html, text: subject }).catch((e) =>
        console.error("[admin][max-dogs-certs][review] email failed", e)
      );
    }

    // Telegram
    const emoji = decision === "approved" ? "✅" : "❌";
    await sendTelegramMessage(
      `[DogShift] ${emoji} Certificat OPAn — décision manuelle\n\nSitter : ${sitterName || sitterId}\nMax chiens : ${maxDogs ?? "?"}\nDécision : ${decision === "approved" ? "Approuvé" : "Refusé"}${notes ? `\nNote : ${notes}` : ""}\n\nEmail envoyé à : ${sitterEmail || "—"}`
    ).catch((e) => console.error("[admin][max-dogs-certs][review] telegram failed", e));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api][admin][max-dogs-certs][review]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
