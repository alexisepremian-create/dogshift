import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";

import { prisma } from "@/lib/prisma";
import { headObject } from "@/lib/r2";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_ID_MIMES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const ALLOWED_SELFIE_MIMES = new Set(["image/jpeg", "image/png"]);

function normalizeMime(value: unknown) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return v;
}

function parseContentLength(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const __authed = await getAuthedDbUser();
    const userId = __authed?.id ?? null;
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    // (() => null) /* currentUser removed */() removed — use __authed.email / __authed.name
    const email = __authed?.email ?? "";
    if (!email) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    if (!__authed?.id) return new Response("Unauthorized", { status: 401 });

    const body = (await req.json().catch(() => null)) as null | {
      idDocumentKey?: string;
      selfieKey?: string | null;
    };

    const idDocumentKey = typeof body?.idDocumentKey === "string" ? body.idDocumentKey.trim() : "";
    const selfieKeyRaw = typeof body?.selfieKey === "string" ? body.selfieKey.trim() : "";
    const selfieKey = selfieKeyRaw ? selfieKeyRaw : null;

    if (!idDocumentKey) {
      return NextResponse.json({ ok: false, error: "MISSING_ID_DOCUMENT" }, { status: 400 });
    }

    const db = prisma as unknown as {
      sitterProfile: {
        findUnique: (args: unknown) => Promise<
          | {
              id: string;
              sitterId: string;
              displayName?: string | null;
              verificationStatus?: string | null;
            }
          | null
        >;
        update: (args: unknown) => Promise<unknown>;
      };
    };

    const sitterProfile = await db.sitterProfile.findUnique({
      where: { userId: __authed.id },
      select: { id: true, sitterId: true, displayName: true, verificationStatus: true },
    });

    if (!sitterProfile?.id || !sitterProfile?.sitterId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const status = typeof sitterProfile.verificationStatus === "string" ? sitterProfile.verificationStatus : "not_verified";
    if (status === "pending" || status === "approved") {
      return NextResponse.json({ ok: false, error: "RESUBMIT_BLOCKED" }, { status: 409 });
    }

    const expectedPrefix = `identity-verification/${sitterProfile.sitterId}/`;
    if (!idDocumentKey.startsWith(expectedPrefix) || (selfieKey && !selfieKey.startsWith(expectedPrefix))) {
      return NextResponse.json({ ok: false, error: "INVALID_KEY" }, { status: 400 });
    }

    const idHead = await headObject({ key: idDocumentKey });
    const idMime = normalizeMime(idHead?.ContentType);
    const idSize = parseContentLength(idHead?.ContentLength);

    if (!idMime || !ALLOWED_ID_MIMES.has(idMime)) {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
    }
    if (idSize == null || idSize <= 0 || idSize > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 });
    }

    if (selfieKey) {
      const selfieHead = await headObject({ key: selfieKey });
      const selfieMime = normalizeMime(selfieHead?.ContentType);
      const selfieSize = parseContentLength(selfieHead?.ContentLength);

      if (!selfieMime || !ALLOWED_SELFIE_MIMES.has(selfieMime)) {
        return NextResponse.json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
      }
      if (selfieSize == null || selfieSize <= 0 || selfieSize > MAX_BYTES) {
        return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 });
      }
    }

    await db.sitterProfile.update({
      where: { id: sitterProfile.id },
      data: {
        verificationStatus: "pending",
        idDocumentUrl: idDocumentKey,
        selfieUrl: selfieKey,
        verificationSubmittedAt: new Date(),
        verificationReviewedAt: null,
      },
    });

    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
    const sitterName = (sitterProfile.displayName ?? __authed?.name ?? "").trim();
    const firstName = sitterName.split(" ")[0] || "Bonjour";

    // Telegram alert to admin
    await sendTelegramMessage(
      `[DogShift] Nouvelle demande de vérification d'identité\n\nSitter : ${sitterName || sitterProfile.sitterId}\nEmail : ${email}\n\nRevoir : ${APP_URL}/admin/verifications`,
      { bot: "verifications" }
    ).catch((e) => console.error("[verification-submit] telegram failed", e));

    // Receipt email to sitter
    const subject = "Votre demande de vérification a bien été reçue";
    const bodyHtml = `
      <p style="margin:0 0 12px 0;">Bonjour ${firstName},</p>
      <p style="margin:0 0 12px 0;">
        Nous avons bien reçu vos documents pour la vérification de votre identité.
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
    await sendEmail(
      {
        to: email,
        subject,
        html,
        text: `Bonjour ${firstName}, nous avons bien reçu vos documents. Notre équipe va les examiner sous 24–48h ouvrées.`,
      },
      {
        templateName: "sitter-verification-submitted",
        context: "api:host/verification/submit",
        targetUserId: __authed.id,
        metadata: { sitterId: sitterProfile.sitterId },
      },
    ).catch((e) => console.error("[verification-submit] receipt email failed", e));

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api][host][verification][submit] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
