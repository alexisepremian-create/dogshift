import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import { getActiveContractAmendment, getHostContractAmendmentState } from "@/lib/contractAmendments";
import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    let dbUser = await (prisma as any).user.findUnique({
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

    if (!dbUser?.id) {
      const clerkUser = await currentUser();
      const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
      if (!primaryEmail) {
        return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
      }
      const ensured = await ensureDbUserByClerkUserId({
        clerkUserId: userId,
        email: primaryEmail,
        name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
      });
      if (!ensured?.id) {
        return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
      }
      dbUser = await (prisma as any).user.findUnique({
        where: { id: ensured.id },
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
    }

    if (!dbUser?.sitterProfile?.id) {
      return NextResponse.json(
        { ok: false, error: "SITTER_PROFILE_REQUIRED", message: "Créez d’abord votre profil dogsitter." },
        { status: 403 }
      );
    }

    const amendment = await getActiveContractAmendment();
    const amendmentState = await getHostContractAmendmentState({
      sitterProfileId: dbUser.sitterProfile.id,
      contractVersion: typeof dbUser.sitterProfile.contractVersion === "string" ? dbUser.sitterProfile.contractVersion : null,
    });

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.sitterProfile.update({
        where: { id: dbUser.sitterProfile.id },
        data: { termsAcceptedAt: now, termsVersion: CURRENT_TERMS_VERSION },
      });

      if (amendment?.id && amendmentState.needsAcceptance) {
        await (tx as any).sitterContractAmendmentAcceptance.upsert({
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
            acceptedAt: now,
          },
          update: {
            amendmentVersion: amendment.version,
            amendmentTitle: amendment.title,
            amendmentContent: amendment.content,
            acceptedAt: now,
          },
        });
      }
    });

    return NextResponse.json(
      {
        ok: true,
        termsVersion: CURRENT_TERMS_VERSION,
        termsAcceptedAt: now.toISOString(),
        amendmentAccepted: Boolean(amendment?.id && amendmentState.needsAcceptance),
        amendmentVersion: amendment?.version ?? null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][host][accept-compliance] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
