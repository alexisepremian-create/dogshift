/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { runPensionVerificationAgent } from "@/lib/pensionVerificationAgent";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    type SubmitBody = { photoKeys?: string[]; exifData?: Record<string, unknown>[] };
    const body = (await req.json().catch(() => null)) as null | SubmitBody;
    const photoKeys = Array.isArray(body?.photoKeys)
      ? body.photoKeys.filter((k) => typeof k === "string" && k.startsWith("pension-verification/"))
      : [];
    const exifData = Array.isArray(body?.exifData) ? body.exifData : [];

    if (photoKeys.length < 3) {
      return NextResponse.json({ ok: false, error: "MIN_3_PHOTOS_REQUIRED" }, { status: 400 });
    }
    if (photoKeys.length > 8) {
      return NextResponse.json({ ok: false, error: "MAX_8_PHOTOS" }, { status: 400 });
    }

    const db = prisma as any;
    const profile = await db.sitterProfile.findUnique({
      where: { userId },
      select: { id: true, sitterId: true, displayName: true, pensionVerifStatus: true, user: { select: { email: true } } },
    });
    if (!profile?.sitterId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    if (profile.pensionVerifStatus === "approved") {
      return NextResponse.json({ ok: false, error: "ALREADY_APPROVED" }, { status: 409 });
    }

    await db.sitterProfile.update({
      where: { id: profile.id },
      data: {
        pensionVerifStatus: "pending",
        pensionPhotoUrls: photoKeys,
        pensionPhotoSubmittedAt: new Date(),
        pensionAiScore: null,
        pensionAiVerdict: null,
        pensionAiReasoning: null,
        pensionAiReviewedAt: null,
      },
    });

    // Send immediate receipt email so the sitter knows photos were received
    if (profile.user?.email) {
      const firstName = (profile.displayName ?? "").split(" ")[0] || "Bonjour";
      const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
      const subject = "Vos photos ont bien été reçues — Vérification Pension";
      const bodyHtml = `
        <p style="margin:0 0 12px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 12px 0;">
          Nous avons bien reçu vos <strong>${photoKeys.length} photo${photoKeys.length > 1 ? "s" : ""}</strong> pour la vérification de votre logement.
          Notre système d'analyse va les examiner sous peu.
        </p>
        <p style="margin:0 0 12px 0;">
          Vous recevrez un e-mail avec le résultat dès que l'analyse sera terminée (généralement en quelques minutes).
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
        text: `Bonjour ${firstName}, nous avons bien reçu vos ${photoKeys.length} photos. Résultat de l'analyse à venir par e-mail.`,
      }).catch((e) => console.error("[pension-submit] receipt email failed", e));
    }

    // Use waitUntil so Vercel keeps the function alive after response
    waitUntil(
      runPensionVerificationAgent({
        sitterId: profile.sitterId,
        sitterName: profile.displayName ?? "",
        sitterEmail: profile.user?.email ?? "",
        exifData,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api][host][pension-verification][submit]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
