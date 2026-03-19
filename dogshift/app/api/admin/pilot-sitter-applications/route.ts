import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

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
            createdAt: Date;
            updatedAt: Date;
          }>
        >;
      };
    };

    const items = await db.pilotSitterApplication.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, applications: items.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString() })) }, { status: 200 });
  } catch (err) {
    console.error("[api][admin][pilot-sitter-applications][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
