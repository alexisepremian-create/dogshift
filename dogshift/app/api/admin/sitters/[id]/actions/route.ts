import { VerificationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { sendEmail } from "@/lib/email/sendEmail";
import { prisma } from "@/lib/prisma";
import {
  buildContractAccessUrl,
  canGenerateContractAccessLink,
  contractAccessTokenFingerprint,
  contractAccessTokenTtlMs,
  generateContractAccessToken,
  hashActivationCode,
  hashContractAccessToken,
  normalizeSitterLifecycleStatus,
} from "@/lib/sitterContract";

export const runtime = "nodejs";

type ActionType = "select" | "generate_contract_link" | "approve" | "reject" | "suspend" | "reactivate" | "publish" | "unpublish" | "issue_activation_code";

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

function parseAction(value: unknown): ActionType | null {
  if (
    value === "select" ||
    value === "generate_contract_link" ||
    value === "approve" ||
    value === "reject" ||
    value === "suspend" ||
    value === "reactivate" ||
    value === "publish" ||
    value === "unpublish" ||
    value === "issue_activation_code"
  ) {
    return value;
  }
  return null;
}

function actionAllowed(action: ActionType, published: boolean, verificationStatus: VerificationStatus, lifecycleStatus: string) {
  if (action === "select") return lifecycleStatus === "application_received";
  if (action === "generate_contract_link") return canGenerateContractAccessLink(lifecycleStatus as any);
  if (action === "approve") return verificationStatus === VerificationStatus.pending || verificationStatus === VerificationStatus.rejected || verificationStatus === VerificationStatus.not_verified;
  if (action === "reject") return verificationStatus === VerificationStatus.pending || verificationStatus === VerificationStatus.approved;
  if (action === "suspend") return published && verificationStatus === VerificationStatus.approved;
  if (action === "reactivate") return !published && verificationStatus === VerificationStatus.approved && lifecycleStatus === "activated";
  if (action === "publish") return !published && verificationStatus === VerificationStatus.approved && lifecycleStatus === "activated";
  if (action === "unpublish") return published;
  if (action === "issue_activation_code") return lifecycleStatus === "contract_signed";
  return true;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as null | {
      action?: string;
      notes?: string;
      activationCode?: string;
    };

    const action = parseAction(body?.action);
    const notesRaw = typeof body?.notes === "string" ? body.notes.trim() : "";
    const notes = notesRaw ? notesRaw.slice(0, 2000) : null;
    const activationCode = typeof body?.activationCode === "string" ? body.activationCode.trim() : "";

    if (!action) {
      return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
    }

    const sitter = (await (prisma as any).user.findUnique({
      where: { id },
      select: {
        id: true,
        sitterId: true,
        email: true,
        name: true,
        sitterProfile: {
          select: {
            id: true,
            published: true,
            verificationStatus: true,
            verificationNotes: true,
            lifecycleStatus: true,
            contractAccessTokenIssuedAt: true,
            contractAccessTokenExpiresAt: true,
          },
        },
      },
    })) as
      | {
          id: string;
          sitterId?: string | null;
          email?: string | null;
          name?: string | null;
          sitterProfile?: {
            id: string;
            published: boolean;
            verificationStatus: VerificationStatus;
            verificationNotes?: string | null;
            lifecycleStatus?: string | null;
            contractAccessTokenIssuedAt?: Date | null;
            contractAccessTokenExpiresAt?: Date | null;
          } | null;
        }
      | null;

    if (!sitter?.sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const currentStatus = sitter.sitterProfile.verificationStatus;
    const currentPublished = sitter.sitterProfile.published;
    const lifecycleStatus = normalizeSitterLifecycleStatus(sitter.sitterProfile.lifecycleStatus, currentPublished);

    if (!actionAllowed(action, currentPublished, currentStatus, lifecycleStatus)) {
      return NextResponse.json({ ok: false, error: "INVALID_STATE_TRANSITION" }, { status: 409 });
    }

    const data: Record<string, unknown> = {};

    if (action === "select") {
      data.lifecycleStatus = "selected";
      data.published = false;
      data.publishedAt = null;
    }

    let generatedContractLink: string | null = null;
    let generatedContractFingerprint: string | null = null;

    if (action === "generate_contract_link") {
      const secret = (process.env.NEXTAUTH_SECRET || "").trim();
      const baseUrl = publicBaseUrlFromRequest(req);
      if (!secret || !baseUrl) {
        return NextResponse.json({ ok: false, error: "CONFIG_ERROR" }, { status: 500 });
      }

      const rawToken = generateContractAccessToken();
      const issuedAt = new Date();
      const expiresAt = new Date(issuedAt.getTime() + contractAccessTokenTtlMs());
      generatedContractLink = buildContractAccessUrl(baseUrl, rawToken);
      generatedContractFingerprint = contractAccessTokenFingerprint(rawToken);

      data.lifecycleStatus = "contract_to_sign";
      data.published = false;
      data.publishedAt = null;
      data.contractAccessTokenHash = hashContractAccessToken(rawToken, secret);
      data.contractAccessTokenIssuedAt = issuedAt;
      data.contractAccessTokenExpiresAt = expiresAt;
      data.contractAccessTokenUsedAt = null;

      if (sitter.email) {
        const subject = "Signature de votre contrat DogShift";
        const text = [
          `Bonjour ${sitter.name?.trim() || ""},`.trim(),
          "",
          "Votre candidature dogsitter a été sélectionnée par DogShift.",
          "Pour signer votre contrat, utilisez votre lien personnel et sécurisé :",
          generatedContractLink,
          "",
          "Ce lien est strictement personnel, à usage unique, et expirera automatiquement.",
          "Après signature, vous recevrez votre code d’activation par courrier.",
          "",
          "— DogShift",
        ].join("\n");
        const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;"><div style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;font-weight:700;">DogShift</div><h1 style="margin:12px 0 0;font-size:22px;line-height:1.25;color:#0f172a;">Signature de votre contrat dogsitter</h1><p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#334155;">Votre candidature a été sélectionnée. Pour signer votre contrat, utilisez votre lien sécurisé personnel.</p><div style="margin-top:18px;"><a href="${generatedContractLink}" style="display:inline-block;background:#0b0b0c;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:12px;">Accéder au contrat</a></div><p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#64748b;">Ce lien est unique, personnel et expirera automatiquement.</p><p style="margin:8px 0 0;font-size:13px;line-height:1.6;word-break:break-word;"><a href="${generatedContractLink}" style="color:#0f172a;text-decoration:underline;">${generatedContractLink}</a></p><p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Après signature, vous recevrez votre code d’activation par courrier.</p></div></body></html>`;
        await sendEmail({ to: sitter.email, subject, text, html });
      }
    }

    if (action === "approve") {
      data.verificationStatus = VerificationStatus.approved;
      data.verificationReviewedAt = new Date();
      data.verificationNotes = notes ?? sitter.sitterProfile.verificationNotes ?? null;
    }

    if (action === "reject") {
      data.verificationStatus = VerificationStatus.rejected;
      data.verificationReviewedAt = new Date();
      data.verificationNotes = notes ?? sitter.sitterProfile.verificationNotes ?? null;
      data.published = false;
      data.publishedAt = null;
    }

    if (action === "suspend") {
      data.published = false;
      data.publishedAt = null;
      data.verificationNotes = notes ?? sitter.sitterProfile.verificationNotes ?? null;
    }

    if (action === "reactivate") {
      data.published = true;
      data.publishedAt = currentPublished ? undefined : new Date();
      data.verificationNotes = notes ?? sitter.sitterProfile.verificationNotes ?? null;
    }

    if (action === "publish") {
      data.published = true;
      data.publishedAt = currentPublished ? undefined : new Date();
      data.verificationNotes = notes ?? sitter.sitterProfile.verificationNotes ?? null;
    }

    if (action === "unpublish") {
      data.published = false;
      data.publishedAt = null;
      data.verificationNotes = notes ?? sitter.sitterProfile.verificationNotes ?? null;
    }

    if (action === "issue_activation_code") {
      if (!activationCode) {
        return NextResponse.json({ ok: false, error: "ACTIVATION_CODE_REQUIRED" }, { status: 400 });
      }
      data.activationCodeHash = hashActivationCode(activationCode);
      data.activationCodeIssuedAt = new Date();
      data.published = false;
      data.publishedAt = null;
    }

    const updatedProfile = await (prisma as any).sitterProfile.update({
      where: { id: sitter.sitterProfile.id },
      data,
      select: {
        id: true,
        published: true,
        publishedAt: true,
        verificationStatus: true,
        verificationReviewedAt: true,
        verificationNotes: true,
        lifecycleStatus: true,
        activationCodeIssuedAt: true,
        contractAccessTokenIssuedAt: true,
        contractAccessTokenExpiresAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        sitterId: sitter.id,
        profile: {
          id: updatedProfile.id,
          published: updatedProfile.published,
          publishedAt: updatedProfile.publishedAt instanceof Date ? updatedProfile.publishedAt.toISOString() : null,
          verificationStatus: updatedProfile.verificationStatus,
          verificationReviewedAt: updatedProfile.verificationReviewedAt instanceof Date ? updatedProfile.verificationReviewedAt.toISOString() : null,
          verificationNotes: updatedProfile.verificationNotes,
          lifecycleStatus: normalizeSitterLifecycleStatus(updatedProfile.lifecycleStatus, updatedProfile.published),
          activationCodeIssuedAt: updatedProfile.activationCodeIssuedAt instanceof Date ? updatedProfile.activationCodeIssuedAt.toISOString() : null,
          contractAccessTokenIssuedAt: updatedProfile.contractAccessTokenIssuedAt instanceof Date ? updatedProfile.contractAccessTokenIssuedAt.toISOString() : null,
          contractAccessTokenExpiresAt: updatedProfile.contractAccessTokenExpiresAt instanceof Date ? updatedProfile.contractAccessTokenExpiresAt.toISOString() : null,
        },
        contractAccessLink: generatedContractLink,
        contractAccessTokenFingerprint: generatedContractFingerprint,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[api][admin][sitters][actions] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
