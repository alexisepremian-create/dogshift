/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { render } from "@react-email/render";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import {
  ActivationCodeEmail,
  activationCodeEmailPlainText,
  activationCodeEmailSubject,
} from "@/lib/email/templates/activationCodeEmail";
import {
  computeActivationCodeExpiresAt,
  generateUniqueActivationCode,
} from "@/lib/sitterActivationCode";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { logAudit } from "@/lib/audit";
import {
  buildSignedContractSnapshot,
  canAccessContractPage,
  contractAccessTokenFingerprint,
  contractAccessTokenMatches,
  CURRENT_SITTER_CONTRACT_VERSION,
  getContractTokenSecret,
  getContractTokenSecretDiagnostics,
  hashContractAccessToken,
  hasReachedSitterLifecycleStatus,
  isContractAccessLinkExpired,
  maxSitterLifecycleStatus,
  normalizeSitterLifecycleStatus,
  SITTER_CONTRACT_CONTENT,
  SITTER_CONTRACT_TITLE,
} from "@/lib/sitterContract";

/**
 * Best-effort: generate a fresh activation code for the signed sitter and
 * persist it on the SitterProfile.
 *
 * Returns the code + expiry so the caller can send the activation email directly.
 * Returns null on any failure — callers MUST treat that as non-fatal and log.
 * The contract is already persisted by the time this runs.
 */
async function issueActivationCodeForSignedSitter(args: {
  sitterProfileId: string;
}): Promise<{ rawCode: string; expiresAt: Date } | null> {
  try {
    const { rawCode, hash } = await generateUniqueActivationCode(prisma, {
      excludeSitterProfileId: args.sitterProfileId,
    });
    const issuedAt = new Date();
    const expiresAt = computeActivationCodeExpiresAt(issuedAt);
    await (prisma as any).sitterProfile.update({
      where: { id: args.sitterProfileId },
      data: {
        activationCodeHash: hash,
        activationCodeIssuedAt: issuedAt,
        activationCodeExpiresAt: expiresAt,
        activationCodeUsedAt: null,
      },
      select: { id: true },
    });
    return { rawCode, expiresAt };
  } catch (err) {
    console.error("[contract-sign][activation-code] issue failed", {
      sitterProfileId: args.sitterProfileId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Sends the "contrat signé — voici ton code d'activation" email directly.
 * Best-effort: never throws to the caller.
 */
async function sendActivationCodeEmailDirect(params: {
  email: string;
  firstName: string;
  activationCode: string;
  expiresAt: Date;
  baseUrl: string;
}): Promise<void> {
  try {
    const subject = activationCodeEmailSubject();
    const text = activationCodeEmailPlainText({
      firstName: params.firstName,
      activationCode: params.activationCode,
      expiresAt: params.expiresAt,
      baseUrl: params.baseUrl,
    });
    const html = await render(
      ActivationCodeEmail({
        baseUrl: params.baseUrl,
        firstName: params.firstName,
        activationCode: params.activationCode,
        expiresAt: params.expiresAt,
      }),
    );
    await sendEmail(
      { to: params.email, subject, text, html },
      {
        templateName: "sitter-contract-signed",
        context: "api:contract/sign",
      },
    );
    console.info("[contract-sign][email] activation code sent", { to: params.email });
  } catch (err) {
    console.error("[contract-sign][email] activation code send failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export const runtime = "nodejs";

type ContractAccessRecord = {
  id: string;
  userId: string;
  sitterId: string;
  published: boolean;
  lifecycleStatus?: string | null;
  contractSignerName?: string | null;
  contractSignedAt?: Date | null;
  contractSnapshot?: unknown;
  contractVersion?: string | null;
  contractSignedPdfUrl?: string | null;
  contractAccessTokenHash?: string | null;
  contractAccessTokenVersion?: string | null;
  contractAccessTokenIssuedAt?: Date | null;
  contractAccessTokenExpiresAt?: Date | null;
  contractAccessTokenUsedAt?: Date | null;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

type ContractAccessMode = "read" | "sign";

async function resolveContractAccess(rawToken: string, mode: ContractAccessMode): Promise<
  | {
      ok: true;
      profile: ContractAccessRecord;
      lifecycleStatus: ReturnType<typeof normalizeSitterLifecycleStatus>;
      readonlyView: boolean;
      accessVersion: string;
      signedForThisVersion: boolean;
    }
  | { ok: false; status: number; error: string }
> {
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  const secret = getContractTokenSecret();
  const secretDiag = getContractTokenSecretDiagnostics();
  if (!token || !secret) {
    console.warn("[contract-token][resolve][reject]", {
      step: "missing_token_or_secret",
      mode,
      ...secretDiag,
      tokenLen: token.length,
      via: "getContractTokenSecret",
    });
    return { ok: false, status: 400, error: "INVALID_CONTRACT_LINK" };
  }

  const candidateHashPrefix = hashContractAccessToken(token, secret).slice(0, 16);
  const tokenFingerprint = contractAccessTokenFingerprint(token);

  const profiles = (await (prisma as any).sitterProfile.findMany({
    where: {
      contractAccessTokenHash: { not: null },
    },
    select: {
      id: true,
      userId: true,
      sitterId: true,
      published: true,
      lifecycleStatus: true,
      contractSignerName: true,
      contractSignedAt: true,
      contractSnapshot: true,
      contractVersion: true,
      contractSignedPdfUrl: true,
      contractAccessTokenHash: true,
      contractAccessTokenVersion: true,
      contractAccessTokenIssuedAt: true,
      contractAccessTokenExpiresAt: true,
      contractAccessTokenUsedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })) as ContractAccessRecord[];

  const profile = profiles.find((entry) => contractAccessTokenMatches(entry.contractAccessTokenHash, token, secret));
  if (!profile?.id || !profile.sitterId) {
    const sample = profiles.length
      ? profiles
          .slice(0, 8)
          .map((p) => ({
            id: p.id,
            storedHashPrefix:
              typeof p.contractAccessTokenHash === "string" ? p.contractAccessTokenHash.slice(0, 16) : null,
            wouldMatch: contractAccessTokenMatches(p.contractAccessTokenHash, token, secret),
          }))
      : [];
    console.warn("[contract-token][resolve][no-row-match]", {
      step: "hash_lookup",
      mode,
      ...secretDiag,
      via: "getContractTokenSecret",
      tokenFingerprint,
      tokenLen: token.length,
      candidateHashPrefix,
      profilesWithHashCount: profiles.length,
      sampleStoredPrefixes: sample,
    });
    return { ok: false, status: 404, error: "INVALID_CONTRACT_LINK" };
  }

  const lifecycleStatus = normalizeSitterLifecycleStatus(profile.lifecycleStatus, profile.published);
  const accessVersion =
    typeof profile.contractAccessTokenVersion === "string" && profile.contractAccessTokenVersion.trim()
      ? profile.contractAccessTokenVersion.trim()
      : CURRENT_SITTER_CONTRACT_VERSION;
  const alreadySignedForAccessVersion =
    profile.contractSignedAt instanceof Date &&
    typeof profile.contractVersion === "string" &&
    profile.contractVersion.trim() === accessVersion;

  // After POST /sign, the magic link is marked used immediately. Reads must still return the
  // signed contract (snapshot, signer, dates) so the client can show proof + PDF download.
  if (mode === "read" && alreadySignedForAccessVersion) {
    const roStoredPrefix =
      typeof profile.contractAccessTokenHash === "string" ? profile.contractAccessTokenHash.slice(0, 16) : null;
    console.info("[contract-token][resolve][ok]", {
      step: "access_granted_readonly",
      mode,
      ...secretDiag,
      via: "getContractTokenSecret",
      tokenFingerprint,
      candidateHashPrefix,
      storedHashPrefix: roStoredPrefix,
      prefixesAligned: roStoredPrefix === candidateHashPrefix,
      profileId: profile.id,
      readonlyView: true,
    });
    return { ok: true, profile, lifecycleStatus, readonlyView: true, accessVersion, signedForThisVersion: true };
  }

  if (profile.contractAccessTokenUsedAt instanceof Date) {
    console.warn("[contract-token][resolve][reject]", {
      step: "already_used",
      mode,
      ...secretDiag,
      tokenFingerprint,
      profileId: profile.id,
    });
    return { ok: false, status: 410, error: "CONTRACT_LINK_ALREADY_USED" };
  }

  if (isContractAccessLinkExpired(profile.contractAccessTokenExpiresAt)) {
    console.warn("[contract-token][resolve][reject]", {
      step: "expired",
      mode,
      ...secretDiag,
      tokenFingerprint,
      profileId: profile.id,
      expiresAt:
        profile.contractAccessTokenExpiresAt instanceof Date
          ? profile.contractAccessTokenExpiresAt.toISOString()
          : profile.contractAccessTokenExpiresAt,
    });
    return { ok: false, status: 410, error: "CONTRACT_LINK_EXPIRED" };
  }

  if (mode === "sign" && alreadySignedForAccessVersion) {
    console.warn("[contract-token][resolve][reject]", {
      step: "already_signed_version",
      mode,
      ...secretDiag,
      tokenFingerprint,
      profileId: profile.id,
    });
    return { ok: false, status: 409, error: "CONTRACT_ALREADY_SIGNED" };
  }

  if (!canAccessContractPage(lifecycleStatus)) {
    console.warn("[contract-token][resolve][reject]", {
      step: "invalid_lifecycle",
      mode,
      ...secretDiag,
      tokenFingerprint,
      profileId: profile.id,
      lifecycleStatus,
    });
    return { ok: false, status: 409, error: "CONTRACT_LINK_INVALID_STATE" };
  }

  const storedHashPrefix =
    typeof profile.contractAccessTokenHash === "string" ? profile.contractAccessTokenHash.slice(0, 16) : null;
  console.info("[contract-token][resolve][ok]", {
    step: "access_granted",
    mode,
    ...secretDiag,
    via: "getContractTokenSecret",
    tokenFingerprint,
    candidateHashPrefix,
    storedHashPrefix,
    prefixesAligned: storedHashPrefix === candidateHashPrefix,
    profileId: profile.id,
  });

  return {
    ok: true,
    profile,
    lifecycleStatus,
    readonlyView: false,
    accessVersion,
    signedForThisVersion: false,
  };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const access = await resolveContractAccess(token, "read");
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    // One-time consultation: mark link used on first readonly open when not already consumed
    // (e.g. legacy flow). After POST /sign, usedAt is already set — do not 410 here.
    if (access.readonlyView && access.profile.contractAccessTokenUsedAt == null) {
      const consumedAt = new Date();
      const consumed = await (prisma as any).sitterProfile.updateMany({
        where: {
          id: access.profile.id,
          contractAccessTokenUsedAt: null,
        },
        data: {
          contractAccessTokenUsedAt: consumedAt,
        },
      });
      if (!consumed?.count) {
        return NextResponse.json({ ok: false, error: "CONTRACT_LINK_ALREADY_USED" }, { status: 410 });
      }
    }

    const fallbackSnapshot =
      access.profile.contractSnapshot ??
      (access.profile.contractSignedAt instanceof Date && typeof access.profile.contractSignerName === "string"
        ? buildSignedContractSnapshot({
            sitterId: access.profile.sitterId,
            userId: access.profile.userId,
            signerName: access.profile.contractSignerName,
            signedAt: access.profile.contractSignedAt.toISOString(),
            version: access.accessVersion,
          })
        : null);

    return NextResponse.json(
      {
        ok: true,
        readonly: access.readonlyView,
        signedForThisVersion: access.signedForThisVersion,
        infoMessage: access.readonlyView ? "Cette version du contrat a déjà été signée. Ce lien permet uniquement la consultation." : null,
        sitter: {
          sitterId: access.profile.sitterId,
          name: access.profile.user?.name ?? null,
          email: access.profile.user?.email ?? null,
        },
        contract: {
          title: SITTER_CONTRACT_TITLE,
          version: access.accessVersion,
          content: SITTER_CONTRACT_CONTENT,
        },
        contractSnapshot: fallbackSnapshot ?? null,
        contractSignedPdfUrl: access.profile.contractSignedPdfUrl ?? null,
        lifecycleStatus: access.lifecycleStatus,
        contractSignerName: typeof access.profile.contractSignerName === "string" ? access.profile.contractSignerName : null,
        contractSignedAt: access.profile.contractSignedAt instanceof Date ? access.profile.contractSignedAt.toISOString() : null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][contract][sign][token][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const access = await resolveContractAccess(token, "sign");
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    const body = (await req.json().catch(() => null)) as
      | { accepted?: boolean; confirmed?: boolean; signatureName?: string }
      | null;

    const accepted = body?.accepted === true;
    const confirmed = body?.confirmed === true;
    const signatureName = typeof body?.signatureName === "string" ? body.signatureName.trim().slice(0, 120) : "";

    if (!accepted || !confirmed) {
      return NextResponse.json({ ok: false, error: "CONTRACT_ACCEPTANCE_REQUIRED" }, { status: 400 });
    }

    if (!signatureName) {
      return NextResponse.json({ ok: false, error: "SIGNATURE_REQUIRED" }, { status: 400 });
    }

    const signedAt = new Date();
    const snapshot = buildSignedContractSnapshot({
      sitterId: access.profile.sitterId,
      userId: access.profile.userId,
      signerName: signatureName,
      signedAt: signedAt.toISOString(),
      version: access.accessVersion,
    });
    const nextLifecycleStatus = maxSitterLifecycleStatus(access.lifecycleStatus, "contract_signed");
    const keepPublicationState = hasReachedSitterLifecycleStatus(access.lifecycleStatus, "activated");

    await (prisma as any).sitterProfile.update({
      where: { id: access.profile.id },
      data: {
        lifecycleStatus: nextLifecycleStatus,
        ...(keepPublicationState ? {} : { published: false, publishedAt: null }),
        contractVersion: access.accessVersion,
        contractAcceptedAt: signedAt,
        contractSignerName: signatureName,
        contractSignedAt: signedAt,
        contractSignatureValue: signatureName,
        contractSnapshot: snapshot,
        contractSignedPdfUrl: null,
        contractAccessTokenUsedAt: signedAt,
      },
      select: { id: true },
    });

    void logAudit({
      action: "consent.contract_signed",
      actorType: "user",
      actorId: access.profile.userId ?? null,
      targetId: access.profile.id,
      targetType: "SITTER_PROFILE",
      metadata: { contractVersion: access.accessVersion, sitterId: access.profile.sitterId },
    });

    // Post-signature side effects: issue a fresh activation code on the
    // SitterProfile (reuses lib/sitterActivationCode) and email it to the
    // sitter. Both steps are best-effort: failures are logged and swallowed
    // because the contract is already persisted and must never appear
    // un-signed to the sitter.
    const activationCode = await issueActivationCodeForSignedSitter({
      sitterProfileId: access.profile.id,
    });
    // Prefer the name used to sign the contract; fall back to the DB user name.
    const sitterName =
      (typeof access.profile.contractSignerName === "string" && access.profile.contractSignerName.trim()
        ? access.profile.contractSignerName.trim()
        : null) ?? access.profile.user?.name ?? null;
    const sitterEmail = access.profile.user?.email ?? null;

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");

    if (activationCode && sitterEmail) {
      const firstName = sitterName?.split(" ")[0] ?? "";
      await sendActivationCodeEmailDirect({
        email: sitterEmail,
        firstName,
        activationCode: activationCode.rawCode,
        expiresAt: activationCode.expiresAt,
        baseUrl,
      });
    } else {
      console.warn("[contract-sign] skipping activation email: no code or no email", {
        sitterProfileId: access.profile.id,
        hasCode: Boolean(activationCode),
        hasEmail: Boolean(sitterEmail),
      });
    }

    // Telegram admin notification
    const namePart = sitterName ? `\n👤 ${sitterName}` : "";
    const emailPart = sitterEmail ? `\n📧 ${sitterEmail}` : "";
    const codePart = activationCode ? `\n🔑 Code: ${activationCode.rawCode}` : "";
    await sendTelegramMessage(
      `✍️ *Contrat signé !*${namePart}${emailPart}${codePart}\n🆔 ${access.profile.userId}`,
      { bot: "candidatures", parseMode: "Markdown" }
    );

    return NextResponse.json(
      {
        ok: true,
        lifecycleStatus: nextLifecycleStatus,
        contractSignedAt: signedAt.toISOString(),
        message: "Votre contrat a bien été signé. DogShift vous contactera pour la suite de l’activation.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][contract][sign][token][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
