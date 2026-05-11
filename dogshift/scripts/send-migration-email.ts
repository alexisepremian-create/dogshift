/**
 * scripts/send-migration-email.ts
 *
 * ONE-SHOT: send the Clerk → Auth.js migration notice email to every active
 * DogShift user. Run AFTER scripts/migrate-clerk-users.ts has populated the
 * Prisma User table from the Clerk export.
 *
 * For each user:
 *   - if they have a `google` Account row → send the "nothing to do" variant
 *     (template `hasGoogleAccount: true`)
 *   - otherwise → send the "redéfinis ton mot de passe" variant
 *
 * Run modes (from dogshift/):
 *   npx tsx scripts/send-migration-email.ts            # dry-run: prints the
 *                                                       # recipient list +
 *                                                       # which template each
 *                                                       # user would get
 *   npx tsx scripts/send-migration-email.ts --apply   # actually send
 *
 * Required env (loaded from .env.local):
 *   DATABASE_URL       — the database to read users from
 *   RESEND_API_KEY     — Resend API key
 *   EMAIL_FROM         — sender address (already configured for sendEmail)
 *
 * Idempotent: records each successful send in a `ScheduledEmail` row with
 * type="auth_migration_notice" so re-running won't double-send. (Uses the
 * existing ScheduledEmail table — already in the Prisma schema.)
 */
import dotenv from "dotenv";
import { resolve } from "node:path";

import { prisma } from "../lib/prisma";
import { sendEmail } from "../lib/email/sendEmail";
import { renderMigrationNoticeEmail } from "../lib/email/templates/migrationNoticeEmail";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const APPLY = process.argv.includes("--apply");
const NOTICE_TYPE = "auth_migration_notice";

type Recipient = {
  userId: string;
  email: string;
  name: string | null;
  hasGoogle: boolean;
  alreadySent: boolean;
};

async function buildRecipientList(): Promise<Recipient[]> {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const recipients: Recipient[] = [];
  for (const u of users) {
    if (!u.email) continue;

    const googleAccount = await prisma.account.findFirst({
      where: { userId: u.id, provider: "google" },
      select: { id: true },
    });

    const previousSend = await prisma.scheduledEmail.findFirst({
      where: { userId: u.id, type: NOTICE_TYPE, sent: true },
      select: { id: true },
    });

    recipients.push({
      userId: u.id,
      email: u.email,
      name: u.name ?? null,
      hasGoogle: Boolean(googleAccount),
      alreadySent: Boolean(previousSend),
    });
  }
  return recipients;
}

async function main() {
  console.log(`[send-migration-email] running in ${APPLY ? "APPLY" : "DRY-RUN"} mode\n`);

  const recipients = await buildRecipientList();
  const toSend = recipients.filter((r) => !r.alreadySent);

  // Pretty preview so the operator can sanity-check before --apply.
  console.log("=== recipient breakdown ===");
  console.log(`total users in DB:        ${recipients.length}`);
  console.log(`already received notice:  ${recipients.length - toSend.length}`);
  console.log(`new sends queued:         ${toSend.length}`);
  const googleCount = toSend.filter((r) => r.hasGoogle).length;
  console.log(`  - "Google, rien à faire" variant:    ${googleCount}`);
  console.log(`  - "redéfinis ton mot de passe":      ${toSend.length - googleCount}`);
  console.log("");

  if (toSend.length === 0) {
    console.log("Nothing to send. Exiting.");
    await prisma.$disconnect();
    return;
  }

  console.log("=== recipients ===");
  for (const r of toSend) {
    const tag = r.hasGoogle ? "[google]    " : "[credentials]";
    console.log(`  ${tag}  ${r.email}  (${r.name ?? "no name"})`);
  }
  console.log("");

  if (!APPLY) {
    console.log("Dry-run done. Re-run with --apply to actually send.");
    await prisma.$disconnect();
    return;
  }

  let succeeded = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const r of toSend) {
    const rendered = renderMigrationNoticeEmail({ name: r.name, hasGoogleAccount: r.hasGoogle });
    try {
      await sendEmail({
        to: r.email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });

      await prisma.scheduledEmail.create({
        data: {
          userId: r.userId,
          email: r.email,
          type: NOTICE_TYPE,
          sendAfter: new Date(),
          sent: true,
          sentAt: new Date(),
        },
      });

      succeeded += 1;
      console.log(`  ✓ ${r.email}`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${r.email}: ${msg}`);
      console.error(`  ✗ ${r.email} — ${msg}`);
    }
  }

  console.log("");
  console.log("=== summary ===");
  console.log(`succeeded: ${succeeded}`);
  console.log(`failed:    ${failed}`);
  for (const f of failures) console.log(`  - ${f}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[send-migration-email] fatal:", err);
  process.exit(1);
});
