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

    type SubmitBody = { photoKeys?: string[] };
    const body = (await req.json().catch(() => null)) as null | SubmitBody;
    const photoKeys = Array.isArray(body?.photoKeys)
      ? body.photoKeys.filter((k) => typeof k === "string" && k.startsWith("pension-verification/"))
      : [];

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

    // Status goes straight to manual review — no AI
    await db.sitterProfile.update({
      where: { id: profile.id },
      data: {
        pensionVerifStatus: "ai_needs_review",
        pensionPhotoUrls: photoKeys,
        pensionPhotoSubmittedAt: new Date(),
        pensionAiScore: null,
        pensionAiVerdict: null,
        pensionAiReasoning: null,
        pensionAiReviewedAt: null,
      },
    });

    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
    const sitterName = (profile.displayName ?? "").trim();
    const firstName = sitterName.split(" ")[0] || "Bonjour";

    // Telegram alert to admin on every new submission
    await sendTelegramMessage(
      `[DogShift] Nouvelle demande de vérification Pension\n\nSitter : ${sitterName || profile.sitterId}\n${photoKeys.length} photo(s) soumise(s)\n\nRevoir : ${APP_URL}/admin/verifications`,
      { bot: "verifications" }
    ).catch((e) => console.error("[pension-submit] telegram failed", e));

    // Receipt email to sitter — "notre équipe vérifie"
    if (profile.user?.email) {
      const subject = "Vos photos ont bien été reçues — Vérification Pension";
      const bodyHtml = `
        <p style="margin:0 0 12px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 12px 0;">
          Nous avons bien reçu vos <strong>${photoKeys.length} photo${photoKeys.length > 1 ? "s" : ""}</strong>
          pour la vérification de votre logement.
        </p>
        <p style="margin:0 0 12px 0;">
          Notre équipe va les examiner et vous envoyer une réponse dans les <strong>24–48 heures ouvrées</strong>.
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
        text: `Bonjour ${firstName}, nous avons bien reçu vos ${photoKeys.length} photos. Notre équipe va les examiner sous 24–48h ouvrées.`,
      }).catch((e) => console.error("[pension-submit] receipt email failed", e));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api][host][pension-verification][submit]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
