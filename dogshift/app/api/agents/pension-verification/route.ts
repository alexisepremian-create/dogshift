/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runPensionVerificationAgent } from "@/lib/pensionVerificationAgent";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as null | { sitterId?: string };
    const sitterId = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";
    if (!sitterId) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

    const db = prisma as any;
    const profile = await db.sitterProfile.findFirst({
      where: { sitterId },
      select: { displayName: true, user: { select: { email: true } } },
    });

    await runPensionVerificationAgent({
      sitterId,
      sitterName: profile?.displayName ?? "",
      sitterEmail: profile?.user?.email ?? "",
    });

    return NextResponse.json({ ok: true, sitterId });
  } catch (err) {
    console.error("[agents][pension-verification]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
