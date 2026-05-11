import { NextResponse } from "next/server";

import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";

import { getActiveContractAmendment, getHostContractAmendmentState } from "@/lib/contractAmendments";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  try {
    const __authed = await getAuthedDbUser();
    const userId = __authed?.id ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        sitterProfile: {
          select: {
            id: true,
            contractVersion: true,
          },
        },
      },
    });

    if (!dbUser?.sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "SITTER_PROFILE_REQUIRED" }, { status: 403 });
    }

    const amendment = await getActiveContractAmendment();
    if (!amendment?.id) {
      return NextResponse.json({ ok: true, needsAcceptance: false, contractAmendment: null });
    }

    const currentState = await getHostContractAmendmentState({
      sitterProfileId: dbUser.sitterProfile.id,
      contractVersion: typeof dbUser.sitterProfile.contractVersion === "string" ? dbUser.sitterProfile.contractVersion : null,
    });

    if (!currentState.needsAcceptance) {
      return NextResponse.json({ ok: true, needsAcceptance: false, contractAmendment: currentState });
    }

    const acceptedAt = new Date();

    await (prisma as any).sitterContractAmendmentAcceptance.upsert({
      where: {
        amendmentId_sitterProfileId: {
          amendmentId: amendment.id,
          sitterProfileId: dbUser.sitterProfile.id,
        },
      },
      create: {
        amendmentId: amendment.id,
        sitterProfileId: dbUser.sitterProfile.id,
        amendmentVersion: amendment.version,
        amendmentTitle: amendment.title,
        amendmentContent: amendment.content,
        acceptedAt,
      },
      update: {
        amendmentVersion: amendment.version,
        amendmentTitle: amendment.title,
        amendmentContent: amendment.content,
        acceptedAt,
      },
    });

    return NextResponse.json({
      ok: true,
      needsAcceptance: false,
      contractAmendment: {
        activeAmendment: amendment,
        isUpToDate: true,
        acceptedAt: acceptedAt.toISOString(),
        acceptedVersion: amendment.version,
        needsAcceptance: false,
      },
    });
  } catch (err) {
    console.error("[api][host][contract-amendment][accept][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
