import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import { headObject } from "@/lib/r2";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_ID_MIMES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const ALLOWED_SELFIE_MIMES = new Set(["image/jpeg", "image/png"]);

function normalizeMime(value: unknown) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return v;
}

function parseContentLength(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    if (!email) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const ensured = await ensureDbUserByClerkUserId({
      clerkUserId: userId,
      email,
      name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
    });
    if (!ensured?.id) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as null | {
      idDocumentKey?: string;
      selfieKey?: string | null;
    };

    const idDocumentKey = typeof body?.idDocumentKey === "string" ? body.idDocumentKey.trim() : "";
    const selfieKeyRaw = typeof body?.selfieKey === "string" ? body.selfieKey.trim() : "";
    const selfieKey = selfieKeyRaw ? selfieKeyRaw : null;

    if (!idDocumentKey) {
      return NextResponse.json({ ok: false, error: "MISSING_ID_DOCUMENT" }, { status: 400 });
    }

    const db = prisma as unknown as {
      sitterProfile: {
        findUnique: (args: unknown) => Promise<
          | {
              id: string;
              sitterId: string;
              verificationStatus?: string | null;
            }
          | null
        >;
        update: (args: unknown) => Promise<unknown>;
      };
    };

    const sitterProfile = await db.sitterProfile.findUnique({
      where: { userId: ensured.id },
      select: { id: true, sitterId: true, verificationStatus: true },
    });

    if (!sitterProfile?.id || !sitterProfile?.sitterId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const status = typeof sitterProfile.verificationStatus === "string" ? sitterProfile.verificationStatus : "not_verified";
    if (status === "pending" || status === "approved") {
      return NextResponse.json({ ok: false, error: "RESUBMIT_BLOCKED" }, { status: 409 });
    }

    const expectedPrefix = `identity-verification/${sitterProfile.sitterId}/`;
    if (!idDocumentKey.startsWith(expectedPrefix) || (selfieKey && !selfieKey.startsWith(expectedPrefix))) {
      return NextResponse.json({ ok: false, error: "INVALID_KEY" }, { status: 400 });
    }

    const idHead = await headObject({ key: idDocumentKey });
    const idMime = normalizeMime(idHead?.ContentType);
    const idSize = parseContentLength(idHead?.ContentLength);

    if (!idMime || !ALLOWED_ID_MIMES.has(idMime)) {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
    }
    if (idSize == null || idSize <= 0 || idSize > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 });
    }

    if (selfieKey) {
      const selfieHead = await headObject({ key: selfieKey });
      const selfieMime = normalizeMime(selfieHead?.ContentType);
      const selfieSize = parseContentLength(selfieHead?.ContentLength);

      if (!selfieMime || !ALLOWED_SELFIE_MIMES.has(selfieMime)) {
        return NextResponse.json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
      }
      if (selfieSize == null || selfieSize <= 0 || selfieSize > MAX_BYTES) {
        return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 });
      }
    }

    await db.sitterProfile.update({
      where: { id: sitterProfile.id },
      data: {
        verificationStatus: "pending",
        idDocumentUrl: idDocumentKey,
        selfieUrl: selfieKey,
        verificationSubmittedAt: new Date(),
        verificationReviewedAt: null,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api][host][verification][submit] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
