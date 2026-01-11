import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";


function generateSitterId() {
  return `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][profile][GET] UNAUTHORIZED", { hasUserId: false });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    if (!primaryEmail) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const dbUser =
      (await prisma.user.findUnique({ where: { email: primaryEmail } })) ??
      (await prisma.user.create({
        data: {
          email: primaryEmail,
          name: typeof clerkUser?.fullName === "string" && clerkUser.fullName.trim() ? clerkUser.fullName.trim() : null,
          role: "SITTER",
        },
      }));

    const uid = dbUser.id;

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    let sitterId = (user as unknown as { sitterId?: string | null }).sitterId ?? null;
    if (!sitterId) {
      sitterId = generateSitterId();
      try {
        await prisma.user.update({
          where: { id: uid },
          data: { sitterId } as unknown as Record<string, unknown>,
        });
      } catch {
        const refreshed = await prisma.user.findUnique({ where: { id: uid } });
        sitterId = (refreshed as unknown as { sitterId?: string | null } | null)?.sitterId ?? sitterId;
      }
    }
    const hostProfileJson = (user as unknown as { hostProfileJson?: string | null }).hostProfileJson ?? null;

    let profile: unknown = null;
    if (hostProfileJson) {
      try {
        profile = JSON.parse(hostProfileJson) as unknown;
      } catch {
        profile = null;
      }
    }

    const sitterProfileDelegate = (prisma as any)?.sitterProfile as
      | {
          upsert: (args: any) => Promise<{ published: boolean; publishedAt: Date | null }>;
        }
      | undefined;

    const sitterProfile = sitterProfileDelegate
      ? await sitterProfileDelegate.upsert({
          where: { userId: uid },
          create: {
            userId: uid,
            sitterId,
            published: false,
            publishedAt: null,
          },
          update: {
            sitterId,
          },
          select: { published: true, publishedAt: true },
        })
      : null;

    return NextResponse.json(
      {
        ok: true,
        sitterId,
        published: Boolean(sitterProfile?.published),
        publishedAt: sitterProfile?.publishedAt instanceof Date ? sitterProfile.publishedAt.toISOString() : null,
        profile,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][host][profile][GET] error", err);
    const message = err instanceof Error ? err.message : "";
    const code = (err as any)?.code as string | undefined;

    if (typeof message === "string" && /no such column/i.test(message)) {
      return NextResponse.json({ ok: false, error: "DB_SCHEMA_MISMATCH", details: message }, { status: 500 });
    }
    if (typeof message === "string" && /database is locked/i.test(message)) {
      return NextResponse.json({ ok: false, error: "DB_LOCKED", details: message }, { status: 503 });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        details: code ? `${code}${message ? `: ${message}` : ""}` : message || undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    if (!primaryEmail) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const dbUser =
      (await prisma.user.findUnique({ where: { email: primaryEmail } })) ??
      (await prisma.user.create({
        data: {
          email: primaryEmail,
          name: typeof clerkUser?.fullName === "string" && clerkUser.fullName.trim() ? clerkUser.fullName.trim() : null,
          role: "SITTER",
        },
      }));

    const uid = dbUser.id;

    const body = (await req.json()) as unknown;

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    let sitterId = (user as unknown as { sitterId?: string | null }).sitterId ?? null;

    if (!sitterId) {
      sitterId = generateSitterId();
      await prisma.user.update({
        where: { id: uid },
        data: { sitterId } as unknown as Record<string, unknown>,
      });
    }

    if (!sitterId) {
      return NextResponse.json({ ok: false, error: "MISSING_SITTER_ID" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const normalized = {
      ...b,
      sitterId,
      profileVersion: 1,
      updatedAt: new Date().toISOString(),
    };

    const hostProfileJson = JSON.stringify(normalized);

    await prisma.user.update({
      where: { id: uid },
      data: { hostProfileJson } as unknown as Record<string, unknown>,
    });

    const publishedFlagRaw = (b as any)?.published;
    const publishedFlag = typeof publishedFlagRaw === "boolean"
      ? publishedFlagRaw
      : (b as any)?.listingStatus === "published" || Boolean((b as any)?.publishedAt);

    const servicesObj = (b as any)?.services && typeof (b as any).services === "object" ? (b as any).services : {};
    const enabledServices = Object.keys(servicesObj).filter((k) => Boolean(servicesObj[k]));
    const pricingObj = (b as any)?.pricing && typeof (b as any).pricing === "object" ? (b as any).pricing : {};
    const dogSizesObj = (b as any)?.dogSizes && typeof (b as any).dogSizes === "object" ? (b as any).dogSizes : {};
    const enabledDogSizes = Object.keys(dogSizesObj).filter((k) => Boolean(dogSizesObj[k]));

    const avatarDataUrl = typeof (b as any)?.avatarDataUrl === "string" ? String((b as any).avatarDataUrl) : "";
    const avatarUrl = avatarDataUrl.trim() ? avatarDataUrl.trim() : null;

    const displayName = typeof (b as any)?.firstName === "string" && String((b as any).firstName).trim()
      ? String((b as any).firstName).trim()
      : null;
    const city = typeof (b as any)?.city === "string" ? String((b as any).city).trim() : null;
    const postalCode = typeof (b as any)?.postalCode === "string" ? String((b as any).postalCode).trim() : null;
    const bio = typeof (b as any)?.bio === "string" ? String((b as any).bio).trim() : null;

    const sitterProfileDelegate = (prisma as any)?.sitterProfile as
      | {
          findUnique: (args: any) => Promise<{ published: boolean; publishedAt: Date | null } | null>;
          upsert: (args: any) => Promise<{ id: string }>;
        }
      | undefined;

    const existingProfile = sitterProfileDelegate
      ? await sitterProfileDelegate.findUnique({
          where: { userId: uid },
          select: { published: true, publishedAt: true },
        })
      : null;

    const willPublish = Boolean(publishedFlag);
    const publishedAt = willPublish
      ? (existingProfile?.publishedAt ?? new Date())
      : null;

    if (sitterProfileDelegate) {
      await sitterProfileDelegate.upsert({
        where: { userId: uid },
        create: {
          userId: uid,
          sitterId,
          published: willPublish,
          publishedAt,
          displayName,
          city,
          postalCode,
          bio,
          avatarUrl,
          services: enabledServices,
          pricing: pricingObj,
          dogSizes: enabledDogSizes,
        },
        update: {
          sitterId,
          published: willPublish,
          publishedAt,
          displayName,
          city,
          postalCode,
          bio,
          avatarUrl,
          services: enabledServices,
          pricing: pricingObj,
          dogSizes: enabledDogSizes,
        },
        select: { id: true },
      });
    }

    return NextResponse.json({ ok: true, sitterId, profile: normalized }, { status: 200 });
  } catch (err) {
    console.error("[api][host][profile][POST] error", err);
    const message = err instanceof Error ? err.message : "";
    const code = (err as any)?.code as string | undefined;

    if (typeof message === "string" && /no such column/i.test(message)) {
      return NextResponse.json({ ok: false, error: "DB_SCHEMA_MISMATCH", details: message }, { status: 500 });
    }
    if (typeof message === "string" && /database is locked/i.test(message)) {
      return NextResponse.json({ ok: false, error: "DB_LOCKED", details: message }, { status: 503 });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        details: code ? `${code}${message ? `: ${message}` : ""}` : message || undefined,
      },
      { status: 500 }
    );
  }
}
