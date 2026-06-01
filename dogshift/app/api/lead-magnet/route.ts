import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderLeadMagnetEmail } from "@/lib/email/templates/leadMagnetEmail";
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

    // Upsert — returns whether this is a new lead (create) or existing (update no-op)
    const result = await prisma.leadMagnet.upsert({
      where:  { email },
      create: { email, source },
      update: {},
      select: { capturedAt: true },
    });

    // Send the welcome email only on first capture (capturedAt close to now)
    const isNew = Date.now() - result.capturedAt.getTime() < 10_000;
    if (isNew) {
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://dogshift.ch").replace(/\/$/, "");
      const { html, text } = renderLeadMagnetEmail({ baseUrl });
      await sendEmail(
        {
          to: email,
          subject: "Votre guide gratuit DogShift 🐕",
          text,
          html,
        },
        {
          templateName: "lead-magnet-guide",
          context: "api:lead-magnet",
          metadata: { source },
        },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      route: "POST /api/lead-magnet",
      extra: { message: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
