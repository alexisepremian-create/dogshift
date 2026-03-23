import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import { prisma } from "@/lib/prisma";
import {
  buildSignedContractSnapshot,
  canAccessContractPage,
  CURRENT_SITTER_CONTRACT_VERSION,
  normalizeSitterLifecycleStatus,
  SITTER_CONTRACT_CONTENT,
  SITTER_CONTRACT_TITLE,
} from "@/lib/sitterContract";

export const runtime = "nodejs";

async function resolveCurrentSitterAccess() {
  const { userId } = await auth();
  if (!userId) return { ok: false as const, error: "UNAUTHORIZED", status: 401 };

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!email) return { ok: false as const, error: "UNAUTHORIZED", status: 401 };

  const ensured = await ensureDbUserByClerkUserId({
    clerkUserId: userId,
    email,
    name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
  });
  if (!ensured?.id) return { ok: false as const, error: "UNAUTHORIZED", status: 401 };

  const sitterProfile = await (prisma as any).sitterProfile.findUnique({
    where: { userId: ensured.id },
    select: {
      id: true,
      userId: true,
      sitterId: true,
      published: true,
      lifecycleStatus: true,
      contractVersion: true,
      contractAcceptedAt: true,
      contractSignerName: true,
      contractSignedAt: true,
      contractSignatureValue: true,
      contractSnapshot: true,
      activatedAt: true,
      activationCodeIssuedAt: true,
    },
  });

  if (!sitterProfile?.id || !sitterProfile.sitterId) {
    return { ok: false as const, error: "FORBIDDEN", status: 403 };
  }

  const lifecycleStatus = normalizeSitterLifecycleStatus(sitterProfile.lifecycleStatus, Boolean(sitterProfile.published));
  return {
    ok: true as const,
    dbUserId: ensured.id,
    sitterProfile,
    lifecycleStatus,
  };
}

export async function GET() {
  try {
    const access = await resolveCurrentSitterAccess();
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    let lifecycleStatus = access.lifecycleStatus;

    if (!canAccessContractPage(lifecycleStatus)) {
      return NextResponse.json({ ok: false, error: "CONTRACT_NOT_AVAILABLE" }, { status: 403 });
    }

    if (lifecycleStatus === "selected") {
      await (prisma as any).sitterProfile.update({
        where: { id: access.sitterProfile.id },
        data: { lifecycleStatus: "contract_to_sign" },
        select: { id: true },
      });
      lifecycleStatus = "contract_to_sign";
    }

    return NextResponse.json(
      {
        ok: true,
        contract: {
          title: SITTER_CONTRACT_TITLE,
          version: CURRENT_SITTER_CONTRACT_VERSION,
          content: SITTER_CONTRACT_CONTENT,
        },
        lifecycleStatus,
        signedContract: access.sitterProfile.contractSnapshot ?? null,
        contractSignerName: typeof access.sitterProfile.contractSignerName === "string" ? access.sitterProfile.contractSignerName : null,
        contractSignedAt: access.sitterProfile.contractSignedAt instanceof Date ? access.sitterProfile.contractSignedAt.toISOString() : null,
        activatedAt: access.sitterProfile.activatedAt instanceof Date ? access.sitterProfile.activatedAt.toISOString() : null,
        activationCodeIssuedAt:
          access.sitterProfile.activationCodeIssuedAt instanceof Date ? access.sitterProfile.activationCodeIssuedAt.toISOString() : null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][host][contract][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await resolveCurrentSitterAccess();
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    if (access.lifecycleStatus !== "selected" && access.lifecycleStatus !== "contract_to_sign") {
      return NextResponse.json({ ok: false, error: "CONTRACT_ALREADY_LOCKED" }, { status: 409 });
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
      sitterId: access.sitterProfile.sitterId,
      userId: access.dbUserId,
      signerName: signatureName,
      signedAt: signedAt.toISOString(),
    });

    await (prisma as any).sitterProfile.update({
      where: { id: access.sitterProfile.id },
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
    console.error("[api][host][contract][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
