/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as null | { photoKey?: string };
    const photoKey = typeof body?.photoKey === "string" && body.photoKey.startsWith("max-dogs-cert/")
      ? body.photoKey
      : null;

    if (!photoKey) {
      return NextResponse.json({ ok: false, error: "DOCUMENT_REQUIRED" }, { status: 400 });
    }

    const db = prisma as any;
    const profile = await db.sitterProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        sitterId: true,
        displayName: true,
        maxDogsCertVerifStatus: true,
        acceptanceCriteria: true,
        user: { select: { email: true } },
      },
    });
    if (!profile?.sitterId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    if (profile.maxDogsCertVerifStatus === "approved") {
      return NextResponse.json({ ok: false, error: "ALREADY_APPROVED" }, { status: 409 });
    }

    const maxDogs =
      profile.acceptanceCriteria && typeof profile.acceptanceCriteria === "object"
        ? (profile.acceptanceCriteria as Record<string, unknown>).maxDogs
        : null;

    await db.sitterProfile.update({
      where: { id: profile.id },
      data: {
        maxDogsCertVerifStatus: "pending",
        maxDogsCertPhotoKey: photoKey,
        maxDogsCertSubmittedAt: new Date(),
        maxDogsCertReviewedAt: null,
        maxDogsCertAdminNotes: null,
      },
    });

    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
    const sitterName = (profile.displayName ?? "").trim();
    const firstName = sitterName.split(" ")[0] || "Bonjour";

    // Telegram alert to admin
    await sendTelegramMessage(
      `[DogShift] 📋 Nouveau document OPAn soumis\n\nSitter : ${sitterName || profile.sitterId}\nMax chiens configuré : ${maxDogs ?? "?"}\n\nRevoir : ${APP_URL}/admin/verifications`
    ).catch((e) => console.error("[max-dogs-cert][submit] telegram failed", e));

    // Receipt email to sitter
    if (profile.user?.email) {
      const subject = "Votre document a bien été reçu — Vérification OPAn";
      const bodyHtml = `
        <p style="margin:0 0 12px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 12px 0;">
          Nous avons bien reçu votre document (attestation FSIFP ou autorisation cantonale)
          pour la vérification requise par la loi suisse (art. 101 OPAn).
        </p>
        <p style="margin:0 0 12px 0;">
          Notre équipe va l'examiner et vous envoyer une réponse dans les <strong>24–48 heures ouvrées</strong>.
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
        to: profile.user.email,
        subject,
        html,
        text: `Bonjour ${firstName}, nous avons bien reçu votre document OPAn. Notre équipe va l'examiner sous 24–48h ouvrées.`,
      }).catch((e) => console.error("[max-dogs-cert][submit] receipt email failed", e));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api][host][max-dogs-cert][submit]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
