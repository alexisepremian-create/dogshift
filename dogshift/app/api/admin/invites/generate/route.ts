import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function randomChunk(len: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function makeSingleUseCode() {
  return `DS-${randomChunk(4)}-${randomChunk(4)}`;
}

function makeMasterCode() {
  return `DS-MASTER-${randomChunk(4)}`;
}

export async function POST() {
  const adminUserId = (process.env.CLERK_ADMIN_USER_ID || "").trim();
  const { userId } = await auth();

  if (!adminUserId || !userId || userId !== adminUserId) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const existingMaster = await (prisma as any).inviteCode.findFirst({
    where: { type: "master" },
    select: { code: true },
    orderBy: { createdAt: "asc" },
  });

  let masterCode = existingMaster?.code ?? "";
  if (!masterCode) {
    for (let i = 0; i < 20; i++) {
      const candidate = makeMasterCode();
      const exists = await (prisma as any).inviteCode.findUnique({ where: { code: candidate }, select: { id: true } });
      if (!exists) {
        await (prisma as any).inviteCode.create({
          data: { code: candidate, type: "master", note: "Alexis" },
          select: { id: true },
        });
        masterCode = candidate;
        break;
      }
    }
  }

  const existingSingle = await (prisma as any).inviteCode.findMany({
    where: { type: "single_use" },
    select: { code: true },
  });

  const singleCodes = new Set<string>(existingSingle.map((c: { code: string }) => c.code));

  while (singleCodes.size < 30) {
    const candidate = makeSingleUseCode();
    if (singleCodes.has(candidate)) continue;

    const exists = await (prisma as any).inviteCode.findUnique({ where: { code: candidate }, select: { id: true } });
    if (exists) continue;

    await (prisma as any).inviteCode.create({
      data: { code: candidate, type: "single_use" },
      select: { id: true },
    });

    singleCodes.add(candidate);
  }

  return NextResponse.json(
    {
      ok: true,
      master: masterCode,
      single_use: Array.from(singleCodes).sort(),
    },
    { status: 200 },
  );
}
