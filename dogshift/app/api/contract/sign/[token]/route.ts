import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  buildSignedContractSnapshot,
  contractAccessTokenMatches,
  contractSigningAllowed,
  CURRENT_SITTER_CONTRACT_VERSION,
  isContractAccessLinkExpired,
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
  contractAccessTokenHash?: string | null;
  contractAccessTokenIssuedAt?: Date | null;
  contractAccessTokenExpiresAt?: Date | null;
  contractAccessTokenUsedAt?: Date | null;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

async function resolveContractAccess(rawToken: string): Promise<
  | { ok: true; profile: ContractAccessRecord; lifecycleStatus: ReturnType<typeof normalizeSitterLifecycleStatus> }
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
      contractAccessTokenHash: true,
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

  if (profile.contractAccessTokenUsedAt instanceof Date || lifecycleStatus === "contract_signed" || lifecycleStatus === "activated") {
    return { ok: false, status: 410, error: "CONTRACT_LINK_ALREADY_USED" };
  }

  if (isContractAccessLinkExpired(profile.contractAccessTokenExpiresAt)) {
    return { ok: false, status: 410, error: "CONTRACT_LINK_EXPIRED" };
  }

  if (!contractSigningAllowed(lifecycleStatus)) {
    return { ok: false, status: 409, error: "CONTRACT_LINK_INVALID_STATE" };
  }

  return { ok: true, profile, lifecycleStatus };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const access = await resolveContractAccess(token);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    return NextResponse.json(
      {
        ok: true,
        sitter: {
          sitterId: access.profile.sitterId,
          name: access.profile.user?.name ?? null,
          email: access.profile.user?.email ?? null,
        },
        contract: {
          title: SITTER_CONTRACT_TITLE,
          version: CURRENT_SITTER_CONTRACT_VERSION,
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
    const access = await resolveContractAccess(token);
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
    });

    await (prisma as any).sitterProfile.update({
      where: { id: access.profile.id },
      data: {
        lifecycleStatus: "contract_signed",
        published: false,
        publishedAt: null,
        contractVersion: CURRENT_SITTER_CONTRACT_VERSION,
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
        lifecycleStatus: "contract_signed",
        contractSignedAt: signedAt.toISOString(),
        message: "Votre contrat a bien été signé. Vous recevrez votre code d’activation par courrier.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][contract][sign][token][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
