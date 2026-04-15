import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { render } from "@react-email/render";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { sendEmail } from "@/lib/email/sendEmail";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import {
  CommunicationsEmail,
  communicationsEmailPlainText,
} from "@/lib/email/templates/communicationsEmail";

export const runtime = "nodejs";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.dogshift.ch";

// Délai entre chaque envoi pour respecter le rate-limit Resend (plan gratuit : 2 req/s)
const DELAY_MS = 550;
function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ─── Validation ────────────────────────────────────────────────────────────────

const sendSchema = z.object({
  subject: z.string().min(3).max(200),
  customMessage: z.string().max(5000).optional(),
  target: z.enum(["all", "sitters", "owners", "custom"]),
  customEmails: z
    .array(z.string().email())
    .max(200)
    .optional()
    .default([]),
  preview: z.boolean().optional().default(false),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getRecipients(
  target: "all" | "sitters" | "owners" | "custom",
  customEmails: string[],
): Promise<{ email: string; firstName: string }[]> {
  // Custom : emails fournis manuellement, pas besoin de DB
  if (target === "custom") {
    return customEmails.map((email) => ({ email, firstName: "" }));
  }

  // Sitters / Owners : filtrés depuis Prisma (qui a le champ role)
  if (target === "sitters" || target === "owners") {
    const users = await prisma.user.findMany({
      where: { role: target === "sitters" ? "SITTER" : "OWNER" },
      select: { email: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    return users.map((u) => ({
      email: u.email,
      firstName: u.name?.split(" ")[0] ?? "",
    }));
  }

  // All : Clerk est la source de vérité pour tous les comptes (paginé par 100)
  const clerk = await clerkClient();
  const result: { email: string; firstName: string }[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const page = await clerk.users.getUserList({ limit, offset });
    for (const u of page.data) {
      const email = u.emailAddresses.find(
        (e) => e.id === u.primaryEmailAddressId,
      )?.emailAddress;
      if (email) {
        result.push({ email, firstName: u.firstName ?? "" });
      }
    }
    if (page.data.length < limit) break;
    offset += limit;
  }

  return result;
}

// ─── GET — Historique des envois ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const admin = await getRequestAdminAccess(req);
  if (!admin.isAdmin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const logs = await (prisma as any).auditLog.findMany({
    where: { action: "communications.email_sent" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      actorId: true,
      metadata: true,
    },
  });

  return NextResponse.json({ ok: true, logs });
}

// ─── POST — Prévisualisation ou envoi ────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await getRequestAdminAccess(req);
  if (!admin.isAdmin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { subject, customMessage = "", target, customEmails, preview } = parsed.data;

  // Mode preview : HTML sans envoi
  if (preview) {
    const html = await render(
      CommunicationsEmail({
        baseUrl: BASE_URL,
        firstName: "Prénom",
        subject,
        customMessage,
        previewText: subject,
      }),
    );
    const text = communicationsEmailPlainText({
      firstName: "Prénom",
      subject,
      customMessage,
      baseUrl: BASE_URL,
    });
    return NextResponse.json({ ok: true, html, text });
  }

  // Récupère les destinataires
  const recipients = await getRecipients(target, customEmails ?? []);
  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "NO_RECIPIENTS" }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const user = recipients[i];
    try {
      const html = await render(
        CommunicationsEmail({
          baseUrl: BASE_URL,
          firstName: user.firstName,
          subject,
          customMessage,
          previewText: subject,
        }),
      );
      const text = communicationsEmailPlainText({
        firstName: user.firstName,
        subject,
        customMessage,
        baseUrl: BASE_URL,
      });

      await sendEmail({ to: user.email, subject, html, text });
      sent++;
    } catch (err) {
      failed++;
      errors.push(`${user.email}: ${err instanceof Error ? err.message : "unknown"}`);
      console.error("[admin][notify-users] send failed", { email: user.email, err });
    }

    if (i < recipients.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Audit log
  await logAudit({
    action: "communications.email_sent",
    actorType: "admin",
    actorId: admin.userId ?? null,
    metadata: {
      subject,
      target,
      total: recipients.length,
      sent,
      failed,
    },
  });

  console.log("[admin][notify-users] done", { target, sent, failed, total: recipients.length });

  return NextResponse.json({ ok: true, total: recipients.length, sent, failed, errors });
}
