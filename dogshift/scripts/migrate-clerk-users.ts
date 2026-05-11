/**
 * scripts/migrate-clerk-users.ts
 *
 * ONE-SHOT migration of all existing Clerk users into the Prisma database
 * so they can sign in via Auth.js v5 after PR 2 ships.
 *
 * What this script does for each Clerk user:
 *   1. Look up the matching `User` row by `clerkUserId` first, then by email.
 *   2. If the row doesn't exist, create it with `passwordHash = null` (the
 *      user will be prompted to use /forgot-password to set a password,
 *      which is covered by the migration notice email — see
 *      lib/email/templates/migrationNoticeEmail.tsx).
 *   3. Update `name`, `image`, `emailVerified` from Clerk's record so the
 *      profile looks right post-migration.
 *   4. If the Clerk user has Google in `externalAccounts`, upsert a
 *      matching `Account` row (provider="google", providerAccountId =
 *      Clerk's `externalId` for that link) so they can `signIn("google")`
 *      next time without seeing a password prompt.
 *   5. Persist `clerkUserId` on the User row so we can re-run idempotently.
 *
 * Reporting (printed at the end):
 *   - X users processed
 *   - Y users updated, Z users created
 *   - W Google OAuth Account rows linked (no-friction next login)
 *   - V users with no passwordHash AND no OAuth account — those need to
 *     hit /forgot-password to regain access (the migration email tells them)
 *
 * SAFE TO RE-RUN. Idempotent by design.
 *
 * Usage (from dogshift/):
 *   npx tsx scripts/migrate-clerk-users.ts          # dry-run (no writes)
 *   npx tsx scripts/migrate-clerk-users.ts --apply  # actually writes to DB
 *
 * Required env (loaded from .env.local via dotenv/config in prisma.config.ts):
 *   CLERK_SECRET_KEY   — Clerk backend API key (already in env for the bridge)
 *   DATABASE_URL       — target DB (point at dev branch first; switch to
 *                        prod main only after a backup + dry-run review)
 */
/* eslint-disable no-console */
import dotenv from "dotenv";
import { createClerkClient } from "@clerk/backend";
import { resolve } from "node:path";

import { prisma } from "../lib/prisma";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const APPLY = process.argv.includes("--apply");

function normalizeEmail(email: string): string {
  return email.replace(/\s+/g, "+").trim().toLowerCase();
}

type Stats = {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  googleLinked: number;
  needsPasswordReset: number;
  errors: string[];
};

async function main() {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) {
    console.error("[migrate-clerk-users] missing CLERK_SECRET_KEY");
    process.exit(1);
  }

  console.log(`[migrate-clerk-users] running in ${APPLY ? "APPLY" : "DRY-RUN"} mode`);

  const clerk = createClerkClient({ secretKey: secret });
  const stats: Stats = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    googleLinked: 0,
    needsPasswordReset: 0,
    errors: [],
  };

  let offset = 0;
  const PAGE_SIZE = 100;

  while (true) {
    const page = await clerk.users.getUserList({ limit: PAGE_SIZE, offset });
    if (!page.data.length) break;

    for (const cu of page.data) {
      stats.processed += 1;

      const rawEmail = cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)?.emailAddress ?? "";
      const email = normalizeEmail(rawEmail);
      if (!email) {
        stats.skipped += 1;
        continue;
      }

      const name = cu.fullName?.trim() || cu.firstName?.trim() || null;
      const image = cu.imageUrl ?? null;
      const googleAccount = cu.externalAccounts.find(
        (a) => (a as { provider?: string }).provider === "oauth_google",
      ) as { provider?: string; externalId?: string; id?: string } | undefined;
      const emailVerifiedAt = cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)
        ?.verification?.status === "verified"
        ? new Date()
        : null;

      try {
        // Match by clerkUserId first (idempotent path on re-run), then email.
        const byClerkId = await prisma.user.findUnique({ where: { clerkUserId: cu.id } });
        const existing = byClerkId ?? (await prisma.user.findUnique({ where: { email } }));

        if (existing) {
          if (APPLY) {
            await prisma.user.update({
              where: { id: existing.id },
              data: {
                clerkUserId: cu.id,
                name: existing.name ?? name,
                image: existing.image ?? image,
                emailVerified: existing.emailVerified ?? emailVerifiedAt,
              },
            });
          }
          stats.updated += 1;
        } else {
          if (APPLY) {
            await prisma.user.create({
              data: {
                clerkUserId: cu.id,
                email,
                name,
                image,
                emailVerified: emailVerifiedAt,
                role: "OWNER", // default; promotions handled separately
              },
            });
          }
          stats.created += 1;
        }

        // OAuth account linking (so the user can hit "Continue with Google"
        // without a password prompt on first login).
        if (googleAccount?.externalId) {
          const userIdForLink =
            (existing?.id ??
              (APPLY
                ? (await prisma.user.findUnique({ where: { email }, select: { id: true } }))?.id
                : null)) ?? null;
          if (userIdForLink && APPLY) {
            await prisma.account.upsert({
              where: {
                provider_providerAccountId: {
                  provider: "google",
                  providerAccountId: googleAccount.externalId,
                },
              },
              create: {
                userId: userIdForLink,
                type: "oauth",
                provider: "google",
                providerAccountId: googleAccount.externalId,
              },
              update: { userId: userIdForLink },
            });
          }
          stats.googleLinked += 1;
        } else {
          // No OAuth link → user MUST hit /forgot-password after the
          // migration email (no passwordHash exists yet for fresh rows
          // and we never receive plaintext passwords from Clerk).
          stats.needsPasswordReset += 1;
        }
      } catch (err) {
        stats.errors.push(
          `${email}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (page.data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log("\n=== migrate-clerk-users summary ===");
  console.log(`mode:                ${APPLY ? "APPLY (wrote to DB)" : "DRY-RUN (no DB writes)"}`);
  console.log(`processed:           ${stats.processed}`);
  console.log(`created (new rows):  ${stats.created}`);
  console.log(`updated (existing):  ${stats.updated}`);
  console.log(`skipped (no email):  ${stats.skipped}`);
  console.log(`google accounts:     ${stats.googleLinked}`);
  console.log(`needs reset email:   ${stats.needsPasswordReset}`);
  if (stats.errors.length) {
    console.log(`errors:              ${stats.errors.length}`);
    for (const e of stats.errors) console.log(`  - ${e}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[migrate-clerk-users] fatal:", err);
  process.exit(1);
});
