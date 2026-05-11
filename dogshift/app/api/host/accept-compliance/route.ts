import { NextResponse } from "next/server";

import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { getActiveContractAmendment, getHostContractAmendmentState } from "@/lib/contractAmendments";
import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST() {
  try {
    const authedUser = await getAuthedDbUser();
    if (!authedUser) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = authedUser.id;

    const dbUser = await prisma.user.findUnique({
      where: { id: authedUser.id },
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
      return NextResponse.json(
        { ok: false, error: "SITTER_PROFILE_REQUIRED", message: "Créez d’abord votre profil dogsitter." },
        { status: 403 }
      );
    }
    const sitterProfileId = dbUser.sitterProfile.id;
    const contractVersion = dbUser.sitterProfile.contractVersion;

    const amendment = await getActiveContractAmendment();
    const amendmentState = await getHostContractAmendmentState({
      sitterProfileId,
      contractVersion: typeof contractVersion === "string" ? contractVersion : null,
    });

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.sitterProfile.update({
        where: { id: sitterProfileId },
        data: { termsAcceptedAt: now, termsVersion: CURRENT_TERMS_VERSION },
      });

      if (amendment?.id && amendmentState.needsAcceptance) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic Prisma model
        await (tx as any).sitterContractAmendmentAcceptance.upsert({
          where: {
            amendmentId_sitterProfileId: {
              amendmentId: amendment.id,
              sitterProfileId,
            },
          },
          create: {
            amendmentId: amendment.id,
            sitterProfileId,
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

    void logAudit({
      action: "consent.host_terms",
      actorType: "user",
      actorId: userId,
      targetId: dbUser.id,
      metadata: { termsVersion: CURRENT_TERMS_VERSION },
    });
    if (amendment?.id && amendmentState.needsAcceptance) {
      void logAudit({
        action: "consent.contract_amendment",
        actorType: "user",
        actorId: userId,
        targetId: sitterProfileId,
        metadata: { amendmentVersion: amendment.version, amendmentId: amendment.id },
      });
    }

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
