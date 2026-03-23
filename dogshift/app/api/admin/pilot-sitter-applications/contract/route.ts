import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { ensureDbUserByEmail } from "@/lib/auth/resolveDbUserId";
import { sendEmail } from "@/lib/email/sendEmail";
import { prisma } from "@/lib/prisma";
import {
  buildContractAccessUrl,
  contractAccessTokenFingerprint,
  contractAccessTokenTtlMs,
  generateContractAccessToken,
  hashContractAccessToken,
} from "@/lib/sitterContract";

export const runtime = "nodejs";

function publicBaseUrlFromRequest(req: NextRequest) {
  const envUrl = (process.env.NEXTAUTH_URL || "").trim();
  if (envUrl) {
    try {
      const u = new URL(envUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      // ignore invalid env url
    }
  }

  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
  const host =
    (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim() ||
    (req.headers.get("host") || "").split(",")[0]?.trim() ||
    "";
  if (!host) return "";
  return `${proto}://${host}`;
}

function generateSitterId() {
  return `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getRequestAdminAccess(req);
    if (!admin.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { id?: string } | null;
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const secret = (process.env.NEXTAUTH_SECRET || "").trim();
    const baseUrl = publicBaseUrlFromRequest(req);
    if (!secret || !baseUrl) {
      return NextResponse.json({ ok: false, error: "CONFIG_ERROR" }, { status: 500 });
    }

    const application = await (prisma as any).pilotSitterApplication.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        email: true,
        firstName: true,
        lastName: true,
        city: true,
      },
    });

    if (!application?.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (application.status !== "ACCEPTED") {
      return NextResponse.json({ ok: false, error: "INVALID_STATE_TRANSITION" }, { status: 409 });
    }

    const ensured = await ensureDbUserByEmail({
      email: application.email,
      name: `${application.firstName} ${application.lastName}`.trim() || application.email,
    });

    if (!ensured?.id) {
      return NextResponse.json({ ok: false, error: "DB_USER_UNAVAILABLE" }, { status: 500 });
    }

    let sitterId = ensured.sitterId;
    if (!sitterId) {
      sitterId = generateSitterId();
      await prisma.user.update({
        where: { id: ensured.id },
        data: { sitterId, role: "SITTER" },
        select: { id: true },
      });
    }

    const rawToken = generateContractAccessToken();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + contractAccessTokenTtlMs());
    const contractAccessLink = buildContractAccessUrl(baseUrl, rawToken);
    const contractLinkFingerprint = contractAccessTokenFingerprint(rawToken);

    await (prisma as any).sitterProfile.upsert({
      where: { userId: ensured.id },
      create: {
        userId: ensured.id,
        sitterId,
        published: false,
        publishedAt: null,
        lifecycleStatus: "contract_to_sign",
        displayName: `${application.firstName} ${application.lastName}`.trim() || null,
        city: application.city || null,
        contractAccessTokenHash: hashContractAccessToken(rawToken, secret),
        contractAccessTokenIssuedAt: issuedAt,
        contractAccessTokenExpiresAt: expiresAt,
        contractAccessTokenUsedAt: null,
      },
      update: {
        sitterId,
        published: false,
        publishedAt: null,
        lifecycleStatus: "contract_to_sign",
        displayName: `${application.firstName} ${application.lastName}`.trim() || undefined,
        city: application.city || null,
        contractAccessTokenHash: hashContractAccessToken(rawToken, secret),
        contractAccessTokenIssuedAt: issuedAt,
        contractAccessTokenExpiresAt: expiresAt,
        contractAccessTokenUsedAt: null,
      },
      select: {
        id: true,
        lifecycleStatus: true,
        contractAccessTokenIssuedAt: true,
        contractAccessTokenExpiresAt: true,
      },
    });

    if (application.email) {
      const recipientName = `${application.firstName} ${application.lastName}`.trim();
      const subject = "Signature de votre contrat DogShift";
      const text = [
        `Bonjour ${recipientName || ""},`.trim(),
        "",
        "Votre candidature dogsitter a été acceptée par DogShift.",
        "Pour signer votre contrat, utilisez votre lien personnel et sécurisé :",
        contractAccessLink,
        "",
        "Ce lien est strictement personnel, à usage unique, et expirera automatiquement.",
        "Après signature, votre contrat sera enregistré par DogShift. La suite sera gérée manuellement par notre équipe.",
        "",
        "— DogShift",
      ].join("\n");
      const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;"><div style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;font-weight:700;">DogShift</div><h1 style="margin:12px 0 0;font-size:22px;line-height:1.25;color:#0f172a;">Signature de votre contrat dogsitter</h1><p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#334155;">Votre candidature a été acceptée. Pour signer votre contrat, utilisez votre lien sécurisé personnel.</p><div style="margin-top:18px;"><a href="${contractAccessLink}" style="display:inline-block;background:#0b0b0c;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:12px;">Accéder au contrat</a></div><p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#64748b;">Ce lien est unique, personnel et expirera automatiquement.</p><p style="margin:8px 0 0;font-size:13px;line-height:1.6;word-break:break-word;"><a href="${contractAccessLink}" style="color:#0f172a;text-decoration:underline;">${contractAccessLink}</a></p><p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Après signature, votre contrat sera enregistré par DogShift. Aucun dashboard sitter n’est ouvert à ce stade.</p></div></body></html>`;
      await sendEmail({ to: application.email, subject, text, html });
    }

    return NextResponse.json(
      {
        ok: true,
        contractAccessLink,
        contractAccessTokenFingerprint: contractLinkFingerprint,
        profile: {
          userId: ensured.id,
          sitterId,
          lifecycleStatus: "contract_to_sign",
          contractAccessTokenIssuedAt: issuedAt.toISOString(),
          contractAccessTokenExpiresAt: expiresAt.toISOString(),
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[api][admin][pilot-sitter-applications][contract][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
