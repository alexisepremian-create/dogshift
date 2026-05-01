import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { reportApiError } from "@/lib/observability/reportApiError";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  source: z.string().max(100).optional().default("homepage_banner"),
});

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const { email, source } = parsed.data;

    // Upsert — silently ignore duplicates (idempotent)
    await prisma.leadMagnet.upsert({
      where:  { email },
      create: { email, source },
      update: {},
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    reportApiError(err, { route: "POST /api/lead-magnet" });
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
