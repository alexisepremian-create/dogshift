#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * One-shot: check the email/nudge history of a single sitter to decide whether
 * the new sitter-onboarding-nudge cron would send something jarring.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/brain/check-sitter-email-history.ts "Sysy"
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const needle = (process.argv[2] ?? "").trim();
  if (!needle) {
    console.error("Usage: check-sitter-email-history.ts <displayName-substring>");
    process.exit(1);
  }

  const sitter = (await (prisma as any).sitterProfile.findFirst({
    where: {
      OR: [
        { displayName: { contains: needle, mode: "insensitive" } },
        { user: { name: { contains: needle, mode: "insensitive" } } },
        { user: { email: { contains: needle, mode: "insensitive" } } },
        { city: { contains: needle, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      userId: true,
      displayName: true,
      city: true,
      published: true,
      activatedAt: true,
      inactivityStatus: true,
      inactivityNudgeAt: true,
      inactivityWarning1At: true,
      inactivityWarning2At: true,
      inactivitySuspendedAt: true,
      user: { select: { name: true, email: true } },
    },
  })) as any;

  if (!sitter) {
    console.log(`Aucun sitter trouvé pour "${needle}"`);
    return;
  }

  console.log("═══════════════════════════════════════════════");
  console.log(`Sitter : ${sitter.displayName ?? sitter.user.name} (${sitter.city ?? "—"})`);
  console.log(`Email : ${sitter.user.email}`);
  console.log(`UserId : ${sitter.userId}`);
  console.log(`Activée : ${sitter.activatedAt?.toISOString() ?? "—"}`);
  console.log(`Publiée : ${sitter.published ? "OUI" : "NON"}`);
  console.log("");
  console.log("État inactivité :");
  console.log(`  status: ${sitter.inactivityStatus ?? "(null)"}`);
  console.log(`  nudgeAt: ${sitter.inactivityNudgeAt?.toISOString() ?? "—"}`);
  console.log(`  warning1At: ${sitter.inactivityWarning1At?.toISOString() ?? "—"}`);
  console.log(`  warning2At: ${sitter.inactivityWarning2At?.toISOString() ?? "—"}`);
  console.log(`  suspendedAt: ${sitter.inactivitySuspendedAt?.toISOString() ?? "—"}`);

  const logs = await (prisma as any).agentLog.findMany({
    where: { targetId: sitter.userId },
    select: { agentName: true, actionType: true, summary: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  console.log("");
  console.log(`AgentLog (${logs.length} entries ciblant son userId) :`);
  if (logs.length === 0) console.log("  (aucune)");
  for (const l of logs) {
    const dt = l.createdAt instanceof Date ? l.createdAt.toISOString().slice(0, 19) : String(l.createdAt);
    console.log(`  ${dt} | ${l.agentName} / ${l.actionType} | ${l.status} | ${(l.summary ?? "").slice(0, 100)}`);
  }

  const emailLogs = await (prisma as any).agentLog.findMany({
    where: { summary: { contains: sitter.user.email, mode: "insensitive" } },
    select: { agentName: true, actionType: true, summary: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  console.log("");
  console.log(`AgentLog mentionnant son email dans le summary (${emailLogs.length}) :`);
  if (emailLogs.length === 0) console.log("  (aucune)");
  for (const l of emailLogs) {
    const dt = l.createdAt instanceof Date ? l.createdAt.toISOString().slice(0, 19) : String(l.createdAt);
    console.log(`  ${dt} | ${l.agentName} / ${l.actionType} | ${l.status} | ${(l.summary ?? "").slice(0, 110)}`);
  }
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
