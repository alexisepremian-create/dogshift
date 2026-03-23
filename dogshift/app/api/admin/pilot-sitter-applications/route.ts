import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { normalizeSitterLifecycleStatus } from "@/lib/sitterContract";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const admin = await getRequestAdminAccess(req);
    if (!admin.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const db = prisma as unknown as {
      pilotSitterApplication: {
        findMany: (args: unknown) => Promise<
          Array<{
            id: string;
            firstName: string;
            lastName: string;
            city: string;
            email: string;
            phone: string;
            age: number | null;
            experienceText: string;
            hasDogExperience: boolean;
            motivationText: string;
            availabilityText: string;
            consentInterview: boolean;
            consentPrivacy: boolean;
            status: "PENDING" | "CONTACTED" | "ACCEPTED" | "REJECTED";
            utmSource: string | null;
            utmMedium: string | null;
            utmCampaign: string | null;
            utmContent: string | null;
            utmTerm: string | null;
            referrer: string | null;
            userAgent: string | null;
            ip: string | null;
            linkedUserId: string | null;
            sitterProfileId: string | null;
            sitterLifecycleStatus: string | null;
            contractAccessTokenIssuedAt: Date | null;
            contractAccessTokenExpiresAt: Date | null;
            contractSignedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
          }>
        >;
      };
    };

    const items = await db.pilotSitterApplication.findMany({
      orderBy: { createdAt: "desc" },
    });

    const emails = Array.from(new Set(items.map((item) => item.email.trim().toLowerCase()).filter(Boolean)));
    const users = emails.length
      ? await prisma.user.findMany({
          where: { email: { in: emails } },
          select: {
            id: true,
            email: true,
            sitterProfile: {
              select: {
                id: true,
                published: true,
                lifecycleStatus: true,
                contractAccessTokenIssuedAt: true,
                contractAccessTokenExpiresAt: true,
                contractSignedAt: true,
              },
            },
          },
        })
      : [];

    const byEmail = new Map(users.map((user) => [user.email.trim().toLowerCase(), user]));

    return NextResponse.json(
      {
        ok: true,
        applications: items.map((a) => {
          const linkedUser = byEmail.get(a.email.trim().toLowerCase());
          const linkedProfile = linkedUser?.sitterProfile ?? null;
          return {
            ...a,
            linkedUserId: linkedUser?.id ?? null,
            sitterProfileId: linkedProfile?.id ?? null,
            sitterLifecycleStatus: linkedProfile ? normalizeSitterLifecycleStatus(linkedProfile.lifecycleStatus, linkedProfile.published) : null,
            contractAccessTokenIssuedAt: linkedProfile?.contractAccessTokenIssuedAt ? linkedProfile.contractAccessTokenIssuedAt.toISOString() : null,
            contractAccessTokenExpiresAt: linkedProfile?.contractAccessTokenExpiresAt ? linkedProfile.contractAccessTokenExpiresAt.toISOString() : null,
            contractSignedAt: linkedProfile?.contractSignedAt ? linkedProfile.contractSignedAt.toISOString() : null,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString(),
          };
        }),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[api][admin][pilot-sitter-applications][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
