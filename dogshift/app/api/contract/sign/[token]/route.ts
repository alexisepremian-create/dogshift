import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  buildSignedContractSnapshot,
  canAccessContractPage,
  contractAccessTokenMatches,
  CURRENT_SITTER_CONTRACT_VERSION,
  hasReachedSitterLifecycleStatus,
  isContractAccessLinkExpired,
  maxSitterLifecycleStatus,
  normalizeSitterLifecycleStatus,
  SITTER_CONTRACT_CONTENT,
  SITTER_CONTRACT_TITLE,
} from "@/lib/sitterContract";

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
    }
  | { ok: false; status: number; error: string }
> {
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  const secret = (process.env.NEXTAUTH_SECRET || "").trim();
  if (!token || !secret) {
    return { ok: false, status: 400, error: "INVALID_CONTRACT_LINK" };
  }

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

  if (profile.contractAccessTokenUsedAt instanceof Date) {
    return { ok: false, status: 410, error: "CONTRACT_LINK_ALREADY_USED" };
  }

  if (isContractAccessLinkExpired(profile.contractAccessTokenExpiresAt)) {
    return { ok: false, status: 410, error: "CONTRACT_LINK_EXPIRED" };
  }

  if (mode === "sign" && alreadySignedForAccessVersion) {
    return { ok: false, status: 409, error: "CONTRACT_ALREADY_SIGNED" };
  }

  if (mode === "read" && alreadySignedForAccessVersion) {
    return { ok: true, profile, lifecycleStatus, readonlyView: true, accessVersion };
  }

  if (!canAccessContractPage(lifecycleStatus)) {
    return { ok: false, status: 409, error: "CONTRACT_LINK_INVALID_STATE" };
  }

  return { ok: true, profile, lifecycleStatus, readonlyView: false, accessVersion };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const access = await resolveContractAccess(token, "read");
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    if (access.readonlyView) {
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

    return NextResponse.json(
      {
        ok: true,
        readonly: access.readonlyView,
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
        contractAccessTokenUsedAt: signedAt,
      },
      select: { id: true },
    });

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
