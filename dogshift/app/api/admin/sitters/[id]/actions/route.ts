import { VerificationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { sendEmail } from "@/lib/email/sendEmail";
import { prisma } from "@/lib/prisma";
import {
  buildContractAccessUrl,
  CURRENT_SITTER_CONTRACT_VERSION,
  contractAccessTokenMatches,
  contractAccessTokenFingerprint,
  contractAccessTokenTtlMs,
  generateContractAccessToken,
  getContractTokenSecret,
  getContractTokenSecretDiagnostics,
  hashContractAccessToken,
  hasReachedSitterLifecycleStatus,
  maxSitterLifecycleStatus,
  normalizeSitterLifecycleStatus,
} from "@/lib/sitterContract";

export const runtime = "nodejs";

type ActionType = "select" | "generate_contract_link" | "approve" | "reject" | "suspend" | "reactivate" | "publish" | "unpublish";

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
    value === "unpublish"
  ) {
    return value;
  }
  return null;
}

function actionAllowed(action: ActionType, published: boolean, verificationStatus: VerificationStatus, lifecycleStatus: string) {
  if (action === "select") return lifecycleStatus === "application_received";
  if (action === "generate_contract_link") return true;
  if (action === "approve") return verificationStatus === VerificationStatus.pending || verificationStatus === VerificationStatus.rejected || verificationStatus === VerificationStatus.not_verified;
  if (action === "reject") return verificationStatus === VerificationStatus.pending || verificationStatus === VerificationStatus.approved;
  if (action === "suspend") return published && verificationStatus === VerificationStatus.approved;
  if (action === "reactivate") return !published && verificationStatus === VerificationStatus.approved && lifecycleStatus === "activated";
  if (action === "publish") return !published && verificationStatus === VerificationStatus.approved && lifecycleStatus === "activated";
  if (action === "unpublish") return published;
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
    };

    const action = parseAction(body?.action);
    const notesRaw = typeof body?.notes === "string" ? body.notes.trim() : "";
    const notes = notesRaw ? notesRaw.slice(0, 2000) : null;

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
            contractVersion: true,
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
            contractVersion?: string | null;
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
    const isAlreadyActivated = hasReachedSitterLifecycleStatus(lifecycleStatus, "activated");

    if (!actionAllowed(action, currentPublished, currentStatus, lifecycleStatus)) {
      return NextResponse.json({ ok: false, error: "INVALID_STATE_TRANSITION" }, { status: 409 });
    }

    const data: Record<string, unknown> = {};

    if (action === "select") {
      data.lifecycleStatus = maxSitterLifecycleStatus(lifecycleStatus, "selected");
      if (!isAlreadyActivated) {
        data.published = false;
        data.publishedAt = null;
      }
    }

    let generatedContractLink: string | null = null;
    let generatedContractFingerprint: string | null = null;
    let generatedContractToken: string | null = null;
    let generatedContractIssuedAt: Date | null = null;
    let generatedContractExpiresAt: Date | null = null;
    let contractEmail: { to: string; subject: string; text: string; html: string } | null = null;

    if (action === "generate_contract_link") {
      const secret = getContractTokenSecret();
      const baseUrl = publicBaseUrlFromRequest(req);
      if (!secret || !baseUrl) {
        return NextResponse.json({ ok: false, error: "CONFIG_ERROR" }, { status: 500 });
      }

      const rawToken = generateContractAccessToken();
      const issuedAt = new Date();
      const expiresAt = new Date(issuedAt.getTime() + contractAccessTokenTtlMs());
      generatedContractLink = buildContractAccessUrl(baseUrl, rawToken);
      generatedContractFingerprint = contractAccessTokenFingerprint(rawToken);
      generatedContractToken = rawToken;
      generatedContractIssuedAt = issuedAt;
      generatedContractExpiresAt = expiresAt;
      const issuedContractVersion = `${CURRENT_SITTER_CONTRACT_VERSION}-${generatedContractFingerprint}`;

      // Re-issue a fresh signature session, but NEVER regress an already-activated sitter.
      if (!isAlreadyActivated) {
        data.lifecycleStatus = "contract_to_sign";
        data.published = false;
        data.publishedAt = null;
      } else {
        console.info("[admin][actions][generate_contract_link] preserving activated status", {
          userId: sitter.id,
          lifecycleStatus,
        });
      }
      data.contractAccessTokenHash = hashContractAccessToken(rawToken, secret);
      data.contractAccessTokenVersion = issuedContractVersion;
      data.contractAccessTokenIssuedAt = issuedAt;
      data.contractAccessTokenExpiresAt = expiresAt;
      data.contractAccessTokenUsedAt = null;
      data.contractVersion = null;
      data.contractAcceptedAt = null;
      data.contractSignerName = null;
      data.contractSignedAt = null;
      data.contractSignatureValue = null;
      data.contractSnapshot = null;
      data.contractSignedPdfUrl = null;

      if (sitter.email) {
        const logoUrl = `${baseUrl.replace(/\/$/, "")}/dogshift-logo.png`;
        const subject = "Signature de votre contrat DogShift";
        const text = [
          `Bonjour ${sitter.name?.trim() || ""},`.trim(),
          "",
          "Félicitations — votre candidature dogsitter a été retenue pour la phase pilote DogShift.",
          "Nous sélectionnons avec soin les profils qui correspondent au niveau de qualité attendu sur la plateforme.",
          "Pour signer votre contrat, utilisez votre lien personnel et sécurisé :",
          generatedContractLink,
          "",
          "Ce lien est strictement personnel, à usage unique, et expirera automatiquement.",
          "Temps estimé : 1 minute.",
          "Après signature, votre contrat sera enregistré par DogShift et la suite de l’activation sera gérée manuellement.",
          "",
          "— DogShift",
        ].join("\n");
        const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f3f6f9;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;"><div style="margin:0 auto;padding:28px 16px;background:#f3f6f9;"><div style="max-width:560px;margin:0 auto;"><div style="padding:8px 0 20px;text-align:center;background:#ffffff;"><img src="${logoUrl}" width="152" alt="DogShift" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:152px;max-width:152px;height:auto;" /></div><div style="background:#ffffff;border:1px solid #e7edf3;border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,0.08);padding:30px 28px;"><h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:800;color:#0f172a;text-align:center;">Signature de votre contrat dogsitter</h1><div style="margin:22px 0 0;border-radius:14px;background:#f4f7fb;padding:18px 18px 16px;"><p style="margin:0;font-size:15px;line-height:1.65;color:#1e293b;"><strong>Félicitations — votre candidature a été retenue pour la phase pilote DogShift.</strong></p><p style="margin:10px 0 0;font-size:14px;line-height:1.65;color:#475569;">Nous sélectionnons un nombre limité de profils afin de garantir un niveau de qualité élevé.</p><p style="margin:10px 0 0;font-size:14px;line-height:1.65;color:#475569;">Vous faites partie des premiers dogsitters sélectionnés.</p></div><p style="margin:22px 0 0;font-size:14px;line-height:1.7;color:#334155;text-align:center;">Pour finaliser cette étape, signez votre contrat via votre lien personnel et sécurisé.</p><div style="margin:24px 0 0;text-align:center;"><a href="${generatedContractLink}" style="display:inline-block;background:#2F4D6B;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;line-height:1;padding:15px 24px;border-radius:10px;box-shadow:0 8px 20px rgba(47,77,107,0.22);">Signer mon contrat</a></div><p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#64748b;text-align:center;">⏱️ Temps estimé : 1 minute</p><p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#64748b;text-align:center;">Ce lien est unique, personnel et expirera automatiquement.</p><p style="margin:14px 0 0;font-size:12px;line-height:1.7;color:#94a3b8;word-break:break-word;text-align:center;"><a href="${generatedContractLink}" style="color:#64748b;text-decoration:underline;word-break:break-all;">${generatedContractLink}</a></p><p style="margin:20px 0 0;font-size:12px;line-height:1.7;color:#64748b;text-align:center;">Après signature, votre contrat sera enregistré par DogShift. L’activation du compte sera gérée séparément.</p></div><p style="margin:16px 0 0;font-size:11px;line-height:1.6;color:#94a3b8;text-align:center;">DogShift — Plateforme de dogsitting premium en Suisse</p></div></div></body></html>`;
        contractEmail = { to: sitter.email, subject, text, html };
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
        contractAccessTokenIssuedAt: true,
        contractAccessTokenExpiresAt: true,
        contractAccessTokenHash: true,
        contractAccessTokenVersion: true,
        contractAccessTokenUsedAt: true,
      },
    });

    if (action === "generate_contract_link") {
      const secret = getContractTokenSecret();
      if (!secret || !generatedContractToken || !generatedContractIssuedAt || !generatedContractExpiresAt) {
        return NextResponse.json({ ok: false, error: "CONFIG_ERROR" }, { status: 500 });
      }

      const okPersisted = contractAccessTokenMatches(updatedProfile.contractAccessTokenHash, generatedContractToken, secret);
      const sameIssuedAt = updatedProfile.contractAccessTokenIssuedAt instanceof Date && updatedProfile.contractAccessTokenIssuedAt.getTime() === generatedContractIssuedAt.getTime();
      const sameExpiresAt = updatedProfile.contractAccessTokenExpiresAt instanceof Date && updatedProfile.contractAccessTokenExpiresAt.getTime() === generatedContractExpiresAt.getTime();
      const expectedVersion = `${CURRENT_SITTER_CONTRACT_VERSION}-${generatedContractFingerprint}`;
      const sameVersion =
        typeof updatedProfile.contractAccessTokenVersion === "string" &&
        updatedProfile.contractAccessTokenVersion === expectedVersion;
      const usedCleared = updatedProfile.contractAccessTokenUsedAt == null;
      if (!okPersisted || !sameIssuedAt || !sameExpiresAt || !sameVersion || !usedCleared) {
        console.error("[api][admin][sitters][actions] generated link not persisted as expected", {
          sitterProfileId: updatedProfile.id,
          okPersisted,
          sameIssuedAt,
          sameExpiresAt,
          sameVersion,
          usedCleared,
        });
        return NextResponse.json({ ok: false, error: "CONTRACT_LINK_PERSISTENCE_MISMATCH" }, { status: 500 });
      }

      const recomputedPrefix = hashContractAccessToken(generatedContractToken, secret).slice(0, 16);
      const storedPrefix =
        typeof updatedProfile.contractAccessTokenHash === "string"
          ? updatedProfile.contractAccessTokenHash.slice(0, 16)
          : "";
      console.info("[contract-token][mint]", {
        route: "admin/sitters/actions/generate_contract_link",
        via: "getContractTokenSecret",
        ...getContractTokenSecretDiagnostics(),
        tokenFingerprint: generatedContractFingerprint,
        tokenLen: generatedContractToken.length,
        recomputedHashPrefix: recomputedPrefix,
        storedHashPrefix: storedPrefix,
        hashPrefixesMatch: recomputedPrefix === storedPrefix,
        postPersistMatches: okPersisted,
        sitterProfileId: updatedProfile.id,
      });

      if (contractEmail) {
        console.info("[contract-email][send][start]", {
          route: "admin/sitters/actions/generate_contract_link",
          sitterId: sitter.id,
          sitterProfileId: updatedProfile.id,
          to: contractEmail.to,
          tokenFingerprint: generatedContractFingerprint,
        });
        await sendEmail(contractEmail);
        console.info("[contract-email][send][ok]", {
          route: "admin/sitters/actions/generate_contract_link",
          sitterId: sitter.id,
          sitterProfileId: updatedProfile.id,
          to: contractEmail.to,
          tokenFingerprint: generatedContractFingerprint,
        });
      } else {
        console.warn("[contract-email][send][skipped_no_recipient]", {
          route: "admin/sitters/actions/generate_contract_link",
          sitterId: sitter.id,
          sitterProfileId: updatedProfile.id,
          tokenFingerprint: generatedContractFingerprint,
        });
      }
    }

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
