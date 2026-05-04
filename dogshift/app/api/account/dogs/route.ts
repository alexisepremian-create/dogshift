import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { reportApiError } from "@/lib/observability/reportApiError";

const db = prisma as any;

export const runtime = "nodejs";

const dogSchema = z.object({
  name: z.string().min(1).max(60),
  breed: z.string().max(80).optional().nullable(),
  birthYear: z.number().int().min(2000).max(2030).optional().nullable(),
  weightKg: z.number().positive().max(200).optional().nullable(),
  medications: z.string().max(1000).optional().nullable(),
  allergies: z.string().max(500).optional().nullable(),
  vetContact: z.string().max(200).optional().nullable(),
  behaviorNotes: z.string().max(1000).optional().nullable(),
  feedingNotes: z.string().max(500).optional().nullable(),
  isDefault: z.boolean().optional(),
});

async function resolveUserId(): Promise<string | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;
  const user = await prisma.user.findFirst({
    where: { clerkUserId },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function GET() {
  try {
    const userId = await resolveUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dogs = await db.dogProfile.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ dogs });
  } catch (err) {
    console.error("[GET /api/account/dogs]", err);
    reportApiError({ kind: "internal_error", route: "account.dogs.get" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = dogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
    }

    const data = parsed.data;

    // If this is set as default, unset others first
    if (data.isDefault) {
      await db.dogProfile.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    // First dog created is automatically set as default
    const existingCount = await db.dogProfile.count({ where: { userId } });
    const isDefault = data.isDefault ?? existingCount === 0;

    const dog = await db.dogProfile.create({
      data: { ...data, userId, isDefault },
    });

    return NextResponse.json({ dog }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/account/dogs]", err);
    reportApiError({ kind: "internal_error", route: "account.dogs.post" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
