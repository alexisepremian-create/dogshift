import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { buildSignedContractSnapshot, CURRENT_SITTER_CONTRACT_VERSION, SITTER_CONTRACT_CONTENT, SITTER_CONTRACT_TITLE } from "@/lib/sitterContract";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const admin = await getRequestAdminAccess(req);
    if (!admin.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const applicationId = (req.nextUrl.searchParams.get("applicationId") ?? "").trim();
    const id = applicationId || (req.nextUrl.searchParams.get("id") ?? "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const application = await (prisma as any).pilotSitterApplication.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!application?.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const email = typeof application.email === "string" ? application.email.trim().toLowerCase() : "";
    const user = email
      ? await prisma.user.findFirst({
          where: { email },
          select: {
            id: true,
            email: true,
            sitterId: true,
            sitterProfile: {
              select: {
                id: true,
                contractVersion: true,
                contractAccessTokenVersion: true,
                contractAccessTokenIssuedAt: true,
                contractAccessTokenExpiresAt: true,
                contractAccessTokenUsedAt: true,
                contractSignerName: true,
                contractSignedAt: true,
                lifecycleStatus: true,
                contractSnapshot: true,
              },
            },
          },
        })
      : null;

    const profile = user?.sitterProfile ?? null;

    // Some real-world signers may have `contractSignedAt` set by older flows but a missing `contractSnapshot`.
    // For admin traceability, we rebuild a signed snapshot on-the-fly (no DB write) so the "Voir le contrat signé" button
    // remains available regardless of token usage.
    const signedAtIso = profile?.contractSignedAt instanceof Date ? profile.contractSignedAt.toISOString() : null;
    const fallbackSnapshot =
      !profile?.contractSnapshot &&
      signedAtIso &&
      typeof profile?.contractSignerName === "string" &&
      typeof (user?.id ?? "") === "string" &&
      typeof (user?.sitterId ?? "") === "string"
        ? buildSignedContractSnapshot({
            sitterId: user?.sitterId as string,
            userId: user?.id as string,
            signerName: profile?.contractSignerName as string,
            signedAt: signedAtIso,
            version: typeof profile.contractVersion === "string" ? profile.contractVersion : CURRENT_SITTER_CONTRACT_VERSION,
          })
        : null;

    return NextResponse.json(
      {
        ok: true,
        applicationId: application.id,
        currentContract: {
          title: SITTER_CONTRACT_TITLE,
          version: CURRENT_SITTER_CONTRACT_VERSION,
          content: SITTER_CONTRACT_CONTENT,
        },
        profile: profile
          ? {
              userId: user?.id ?? null,
              sitterId: user?.sitterId ?? null,
              profileId: profile.id,
              contractVersion: typeof profile.contractVersion === "string" ? profile.contractVersion : null,
              contractAccessTokenVersion: typeof profile.contractAccessTokenVersion === "string" ? profile.contractAccessTokenVersion : null,
              contractAccessTokenIssuedAt: profile.contractAccessTokenIssuedAt instanceof Date ? profile.contractAccessTokenIssuedAt.toISOString() : null,
              contractAccessTokenExpiresAt: profile.contractAccessTokenExpiresAt instanceof Date ? profile.contractAccessTokenExpiresAt.toISOString() : null,
              contractAccessTokenUsedAt: profile.contractAccessTokenUsedAt instanceof Date ? profile.contractAccessTokenUsedAt.toISOString() : null,
              contractSignerName: typeof profile.contractSignerName === "string" ? profile.contractSignerName : null,
              contractSignedAt: profile.contractSignedAt instanceof Date ? profile.contractSignedAt.toISOString() : null,
              lifecycleStatus: typeof profile.lifecycleStatus === "string" ? profile.lifecycleStatus : null,
              contractSnapshot: profile.contractSnapshot ?? fallbackSnapshot,
            }
          : null,
      },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[api][admin][pilot-sitter-applications][contract-details][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

