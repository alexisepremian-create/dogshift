import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { reportApiError } from "@/lib/observability/reportApiError";

const db = prisma as any;

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  breed: z.string().max(80).optional().nullable(),
  birthYear: z.number().int().min(2000).max(2030).optional().nullable(),
  weightKg: z.number().positive().max(200).optional().nullable(),
  neutered: z.boolean().optional().nullable(),
  medications: z.string().max(1000).optional().nullable(),
  allergies: z.string().max(500).optional().nullable(),
  vetContact: z.string().max(200).optional().nullable(),
  behaviorNotes: z.string().max(1000).optional().nullable(),
  feedingNotes: z.string().max(500).optional().nullable(),
  sitterInstructions: z.string().max(2000).optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable(),
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await resolveUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await db.dogProfile.findFirst({ where: { id, userId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
    }

    const data = parsed.data;

    if (data.isDefault) {
      await db.dogProfile.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const dog = await db.dogProfile.update({ where: { id }, data });
    return NextResponse.json({ dog });
  } catch (err) {
    console.error("[PATCH /api/account/dogs/[id]]", err);
    reportApiError({ kind: "internal_error", route: "account.dogs.patch" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await resolveUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await db.dogProfile.findFirst({ where: { id, userId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.dogProfile.delete({ where: { id } });

    // If deleted dog was default, promote the oldest remaining dog
    if (existing.isDefault) {
      const next = await db.dogProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
      if (next) await db.dogProfile.update({ where: { id: next.id }, data: { isDefault: true } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/account/dogs/[id]]", err);
    reportApiError({ kind: "internal_error", route: "account.dogs.delete" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
