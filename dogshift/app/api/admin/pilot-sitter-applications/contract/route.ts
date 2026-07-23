import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { ensureDbUserByEmail } from "@/lib/auth/resolveDbUserId";
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

    const secret = getContractTokenSecret();
    const baseUrl = publicBaseUrlFromRequest(req);
    if (!secret || !baseUrl) {
      return NextResponse.json({ ok: false, error: "CONFIG_ERROR" }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma client cast while generated types lag the pilot schema.
    const application = await (prisma as any).pilotSitterApplication.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        email: true,
        firstName: true,
        lastName: true,
        city: true,
        // The postal address collected on the form (Phase 1A). May be null for
        // applications submitted before this column existed — in that case the
        // SitterProfile.address stays null until the sitter fills it in their
        // edit page (or until ops backfills it via scripts/brain/).
        address: true,
      },
    });

    if (!application?.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (application.status !== "ACCEPTED" && application.status !== "ACTIVATED") {
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
        data: { sitterId },
        select: { id: true },
      });
    }

    const rawToken = generateContractAccessToken();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + contractAccessTokenTtlMs());
    const contractAccessLink = buildContractAccessUrl(baseUrl, rawToken);
    const contractLinkFingerprint = contractAccessTokenFingerprint(rawToken);
    // Each resend must create a new contract "version" that will require a fresh signature.
    // We bind the contract access version to the generated token fingerprint so:
    // - same token => same version
    // - new resend => new version, even if the contract template is unchanged
    const issuedContractVersion = `${CURRENT_SITTER_CONTRACT_VERSION}-${contractLinkFingerprint}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma client cast while generated types lag the pilot schema.
    const existingProfile = await (prisma as any).sitterProfile.findUnique({
      where: { userId: ensured.id },
      select: {
        id: true,
        published: true,
        lifecycleStatus: true,
        contractVersion: true,
        // Needed by the address back-fill logic below — we never overwrite an
        // address the sitter may have edited from their profile page.
        address: true,
      },
    });
    const currentLifecycleStatus = existingProfile
      ? normalizeSitterLifecycleStatus(existingProfile.lifecycleStatus, existingProfile.published)
      : null;
    // No lifecycle gate here: the admin "Envoyer le contrat" button is the entrypoint
    // from the pilot flow and must work from every upstream state:
    // - no profile / application_received  -> create or promote to contract_to_sign
    // - selected / contract_to_sign        -> keep or re-issue token
    // - contract_signed / activated        -> re-sign path, preserves activation + publication
    // The concrete transition is computed below and protected by the `alreadyActivated` branch.
    const willResetSignatureProof = Boolean(existingProfile?.contractVersion && existingProfile.contractVersion !== issuedContractVersion);
    const alreadyActivated = currentLifecycleStatus ? hasReachedSitterLifecycleStatus(currentLifecycleStatus, "activated") : false;
    // Never regress an activated sitter. For non-activated sitters, downgrade to contract_to_sign when signature proof is reset.
    const nextLifecycleStatus = alreadyActivated
      ? "activated"
      : willResetSignatureProof
        ? "contract_to_sign"
        : currentLifecycleStatus
          ? maxSitterLifecycleStatus(currentLifecycleStatus, "contract_to_sign")
          : "contract_to_sign";
    const keepPublicationState = alreadyActivated;

     
    // Promote `application.address` → `sitterProfile.address` on create so
    // the new SitterProfile already has the postal address the sitter typed
    // into the form. On update we only set the address if it's still null on
    // the existing profile — never overwrite a value the sitter may have
    // edited from their own profile page after the initial application.
    const applicationAddress =
      typeof application.address === "string" && application.address.trim().length > 0
        ? application.address.trim()
        : null;
    const existingProfileAddress =
      typeof existingProfile?.address === "string" && existingProfile.address.trim().length > 0
        ? existingProfile.address.trim()
        : null;
    const shouldBackfillAddressOnUpdate =
      Boolean(applicationAddress) && !existingProfileAddress;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma client cast while generated types lag the pilot schema.
    const persisted = await (prisma as any).sitterProfile.upsert({
      where: { userId: ensured.id },
      create: {
        userId: ensured.id,
        sitterId,
        published: false,
        publishedAt: null,
        lifecycleStatus: "contract_to_sign",
        ...(applicationAddress ? { address: applicationAddress } : {}),
        contractAccessTokenHash: hashContractAccessToken(rawToken, secret),
        contractAccessTokenVersion: issuedContractVersion,
        contractAccessTokenIssuedAt: issuedAt,
        contractAccessTokenExpiresAt: expiresAt,
        contractAccessTokenUsedAt: null,
      },
      update: {
        sitterId,
        ...(keepPublicationState ? {} : { published: false, publishedAt: null }),
        ...(shouldBackfillAddressOnUpdate ? { address: applicationAddress } : {}),
        lifecycleStatus: nextLifecycleStatus,
        contractAccessTokenHash: hashContractAccessToken(rawToken, secret),
        contractAccessTokenVersion: issuedContractVersion,
        contractAccessTokenIssuedAt: issuedAt,
        contractAccessTokenExpiresAt: expiresAt,
        contractAccessTokenUsedAt: null,
        ...(willResetSignatureProof
          ? {
              contractVersion: null,
              contractAcceptedAt: null,
              contractSignerName: null,
              contractSignedAt: null,
              contractSignatureValue: null,
              contractSnapshot: null,
            }
          : {}),
      },
      select: {
        id: true,
        lifecycleStatus: true,
        contractAccessTokenIssuedAt: true,
        contractAccessTokenExpiresAt: true,
        contractAccessTokenHash: true,
        contractAccessTokenVersion: true,
        contractAccessTokenUsedAt: true,
      },
    });

    const okPersisted = contractAccessTokenMatches(persisted?.contractAccessTokenHash, rawToken, secret);
    const sameIssuedAt = persisted?.contractAccessTokenIssuedAt instanceof Date && persisted.contractAccessTokenIssuedAt.getTime() === issuedAt.getTime();
    const sameExpiresAt = persisted?.contractAccessTokenExpiresAt instanceof Date && persisted.contractAccessTokenExpiresAt.getTime() === expiresAt.getTime();
    const sameVersion = typeof persisted?.contractAccessTokenVersion === "string" && persisted.contractAccessTokenVersion === issuedContractVersion;
    const usedCleared = persisted?.contractAccessTokenUsedAt == null;
    if (!okPersisted || !sameIssuedAt || !sameExpiresAt || !sameVersion || !usedCleared) {
      console.error("[api][admin][pilot-sitter-applications][contract] generated link not persisted as expected", {
        applicationId: application.id,
        userId: ensured.id,
        sitterProfileId: persisted?.id ?? null,
        okPersisted,
        sameIssuedAt,
        sameExpiresAt,
        sameVersion,
        usedCleared,
      });
      return NextResponse.json({ ok: false, error: "CONTRACT_LINK_PERSISTENCE_MISMATCH" }, { status: 500 });
    }

    const recomputedPrefix = hashContractAccessToken(rawToken, secret).slice(0, 16);
    const storedPrefix =
      typeof persisted?.contractAccessTokenHash === "string" ? persisted.contractAccessTokenHash.slice(0, 16) : "";
    console.info("[contract-token][mint]", {
      route: "admin/pilot-sitter-applications/contract",
      via: "getContractTokenSecret",
      ...getContractTokenSecretDiagnostics(),
      tokenFingerprint: contractLinkFingerprint,
      tokenLen: rawToken.length,
      recomputedHashPrefix: recomputedPrefix,
      storedHashPrefix: storedPrefix,
      hashPrefixesMatch: recomputedPrefix === storedPrefix,
      postPersistMatches: okPersisted,
      sitterProfileId: persisted?.id ?? null,
    });

    if (application.email) {
      const recipientName = `${application.firstName} ${application.lastName}`.trim();
      const logoUrl = `${baseUrl.replace(/\/$/, "")}/dogshift-logo.png`;
      const subject = "Signature de votre contrat DogShift";
      const text = [
        `Bonjour ${recipientName || ""},`.trim(),
        "",
        "Félicitations — votre candidature dogsitter a été retenue pour la phase pilote DogShift.",
        "Nous sélectionnons avec soin les profils qui correspondent au niveau de qualité attendu sur la plateforme.",
        "Pour signer votre contrat, utilisez votre lien personnel et sécurisé :",
        contractAccessLink,
        "",
        "Ce lien est strictement personnel, à usage unique, et expirera automatiquement.",
        "Temps estimé : 1 minute.",
        "Après signature, votre contrat sera enregistré par DogShift. La suite sera gérée manuellement par notre équipe.",
        "",
        "— DogShift",
      ].join("\n");
      const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f3f6f9;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;"><div style="margin:0 auto;padding:28px 16px;background:#f3f6f9;"><div style="max-width:560px;margin:0 auto;"><div style="padding:8px 0 20px;text-align:center;background:#ffffff;"><img src="${logoUrl}" width="152" alt="DogShift" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:152px;max-width:152px;height:auto;" /></div><div style="background:#ffffff;border:1px solid #e7edf3;border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,0.08);padding:30px 28px;"><h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:800;color:#0f172a;text-align:center;">Signature de votre contrat dogsitter</h1><div style="margin:22px 0 0;border-radius:14px;background:#f4f7fb;padding:18px 18px 16px;"><p style="margin:0;font-size:15px;line-height:1.65;color:#1e293b;"><strong>Félicitations — votre candidature a été retenue pour la phase pilote DogShift.</strong></p><p style="margin:10px 0 0;font-size:14px;line-height:1.65;color:#475569;">Nous sélectionnons un nombre limité de profils afin de garantir un niveau de qualité élevé.</p><p style="margin:10px 0 0;font-size:14px;line-height:1.65;color:#475569;">Vous faites partie des premiers dogsitters sélectionnés.</p></div><p style="margin:22px 0 0;font-size:14px;line-height:1.7;color:#334155;text-align:center;">Pour finaliser cette étape, signez votre contrat via votre lien personnel et sécurisé.</p><div style="margin:24px 0 0;text-align:center;"><a href="${contractAccessLink}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;line-height:1;padding:15px 24px;border-radius:10px;box-shadow:0 8px 20px rgba(47,77,107,0.22);">Signer mon contrat</a></div><p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#64748b;text-align:center;">⏱️ Temps estimé : 1 minute</p><p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#64748b;text-align:center;">Ce lien est unique, personnel et expirera automatiquement.</p><p style="margin:14px 0 0;font-size:12px;line-height:1.7;color:#94a3b8;word-break:break-word;text-align:center;"><a href="${contractAccessLink}" style="color:#64748b;text-decoration:underline;word-break:break-all;">${contractAccessLink}</a></p><p style="margin:20px 0 0;font-size:12px;line-height:1.7;color:#64748b;text-align:center;">Après signature, votre contrat sera enregistré par DogShift. Aucun dashboard sitter n’est ouvert à ce stade.</p></div><p style="margin:16px 0 0;font-size:11px;line-height:1.6;color:#94a3b8;text-align:center;">DogShift — Plateforme de dogsitting premium en Suisse</p></div></div></body></html>`;
      await sendEmail(
        { to: application.email, subject, text, html },
        {
          templateName: "sitter-contract-issued",
          context: "api:admin/pilot-sitter-applications/contract",
          targetUserId: ensured.id,
          metadata: { applicationId: application.id, sitterId },
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        contractAccessLink,
        contractAccessTokenFingerprint: contractLinkFingerprint,
        profile: {
          userId: ensured.id,
          sitterId,
          lifecycleStatus: nextLifecycleStatus,
          contractAccessTokenIssuedAt: issuedAt.toISOString(),
          contractAccessTokenExpiresAt: expiresAt.toISOString(),
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const e = err as {
      name?: string;
      message?: string;
      stack?: string;
      code?: string;
      meta?: unknown;
    };
    console.error("[api][admin][pilot-sitter-applications][contract][POST] error", {
      name: e?.name ?? null,
      code: e?.code ?? null,
      message: e?.message ?? null,
      meta: e?.meta ?? null,
      stack: e?.stack ?? null,
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
